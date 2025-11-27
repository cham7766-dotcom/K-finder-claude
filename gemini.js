console.log("🔥 gemini.js 스크립트 시작!");

// gemini.js - Gemini API를 이용한 상품 분석 모듈 (정리 버전)

// v1 엔드포인트에서 gemini-2.5-flash 모델 사용
const GEMINI_API_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";
const GEMINI_API_KEY = ""; // 사용자가 설정에서 입력할 API 키 (기본값, 실제 키는 storage에서 로드)

/**
 * Gemini API 응답에서 텍스트를 안전하게 추출하는 헬퍼 함수
 * 다양한 응답 구조(candidates.content, candidates[].content[], result.text)를 모두 시도한다.
 */
function extractGeminiText(result) {
  if (!result || typeof result !== "object") {
    throw new Error("Gemini API 응답 형식이 올바르지 않습니다.");
  }

  // 1. SDK 스타일 응답: result.text
  if (typeof result.text === "string" && result.text.trim()) {
    console.log("🔍 [Gemini] 텍스트 추출 경로: result.text");
    return result.text.trim();
  }

  const textParts = [];

  // 내부 Content 구조를 읽는 헬퍼
  const collectFromContent = (content) => {
    if (!content) return;

    // content가 배열일 수도 있음 (예: content: [ { parts: [...] }, ... ])
    if (Array.isArray(content)) {
      content.forEach((c) => collectFromContent(c));
      return;
    }

    if (Array.isArray(content.parts)) {
      for (const part of content.parts) {
        if (typeof part.text === "string" && part.text.trim()) {
          textParts.push(part.text.trim());
        }
      }
    }
  };

  // 2. 표준 REST 응답: candidates[].content.parts[].text
  if (Array.isArray(result.candidates) && result.candidates.length > 0) {
    for (const candidate of result.candidates) {
      if (candidate.content) {
        collectFromContent(candidate.content);
      }
    }
  }

  if (textParts.length > 0) {
    console.log(
      "🔍 [Gemini] 텍스트 추출 경로: candidates.content.parts (총 " +
        textParts.length +
        "개 파트)"
    );
    return textParts.join("\n");
  }

  // 3. 안전성 정책에 의해 차단된 경우
  if (result.promptFeedback && result.promptFeedback.blockReason) {
    throw new Error(
      "Gemini 응답이 안전성 정책에 의해 차단되었습니다: " +
        result.promptFeedback.blockReason
    );
  }

  // 4. 텍스트를 찾지 못한 경우
  console.error("❌ [Gemini] 응답에서 텍스트를 찾지 못했습니다. 전체 응답:", result);

  // 여기서 에러를 던지지 말고, 응답 전체를 문자열로 반환해서
  // 상위 로직(parseGeminiResponse)이 fallback으로 처리할 수 있게 한다.
  console.warn("⚠️ [Gemini] fallback 경로에서 응답 전체를 문자열로 반환합니다.");
  return JSON.stringify(result);
}

/**
 * Shopee 글로벌 판매를 위한 상품 분석
 * @param {Object} productData - 1단계에서 수집한 상품 데이터
 * @returns {Promise<Object>} 분석 결과 (영문 번역, 카테고리, 마케팅 포인트 등)
 */
async function analyzeProductForShopee(productData) {
  try {
    console.log("🤖 [Gemini] 상품 분석 시작:", productData.물품명);

    // API 키 확인
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      return {
        error: true,
        message:
          "Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.",
      };
    }

    // 프롬프트 생성
    const prompt = buildShopeeAnalysisPrompt(productData);

    console.log("🔍 [Gemini] API 호출 시작 - Endpoint:", GEMINI_API_ENDPOINT);

    // Gemini API 호출
    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    console.log(
      "🔍 [Gemini] HTTP 응답 수신 - Status:",
      response.status,
      "StatusText:",
      response.statusText
    );

    // HTTP 에러 처리
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const json = JSON.parse(errorText);
        errorMessage = json.error?.message || errorText;
      } catch (e) {
        // JSON 파싱 실패 시 원본 텍스트 사용
      }

      console.error("❌ [Gemini] HTTP " + response.status + ":", errorMessage);
      throw new Error(
        "Gemini API 오류 (HTTP " + response.status + "): " + errorMessage
      );
    }

    const result = await response.json();

    // 디버깅: 실제 API 응답 전체 구조 로깅
    console.log(
      "🔍 [Gemini] 전체 응답 구조:",
      JSON.stringify(result, null, 2)
    );

    // 응답에서 텍스트 추출
    const generatedText = extractGeminiText(result);

    console.log("🔍 [Gemini] 추출된 텍스트 길이:", generatedText.length);
    console.log(
      "🔍 [Gemini] 추출된 텍스트 (첫 200자):",
      generatedText.substring(0, 200)
    );

    console.log("✅ [Gemini] 분석 완료");

    // JSON 파싱 (Gemini가 JSON 형태로 응답)
    const parsedResult = parseGeminiResponse(generatedText);
    return {
      success: true,
      data: parsedResult,
    };
  } catch (error) {
    console.error("❌ [Gemini] 분석 실패:", error);
    console.error("   - Error name:", error.name);
    console.error("   - Error message:", error.message);
    console.error("   - Error stack:", error.stack);
    return {
      error: true,
      message: error.message || "알 수 없는 오류가 발생했습니다.",
    };
  }
}

/**
 * Shopee 분석용 프롬프트 생성
 */
function buildShopeeAnalysisPrompt(productData) {
  const productInfo = {
    name: productData.물품명 || "",
    brand: productData.브랜드 || "No Brand",
    weight: productData.무게 || "0.5",
    price: productData.구입가 || "",
    options: productData.상품옵션 || [],
    manufacturer: productData.제조사 || "",
    origin: productData.원산지 || productData.원산지세부 || "",
  };

  return `You are a Shopee global e-commerce specialist. Analyze the following Korean product information and provide optimized data for Shopee international listing.

**Product Information:**
- Name (Korean): ${productInfo.name}
- Brand: ${productInfo.brand}
- Weight: ${productInfo.weight} kg
- Price: ${productInfo.price}
- Manufacturer: ${productInfo.manufacturer}
- Origin: ${productInfo.origin}
- Options: ${JSON.stringify(productInfo.options, null, 2)}

**Task:**
1. Translate the product name into English (SEO-optimized, under 120 characters)
2. Generate a compelling English product description (under 300 words, highlight key features and benefits)
3. Suggest 3 most suitable Shopee categories (in English)
4. Extract 5-8 relevant keywords for search optimization
5. Identify 3 key selling points (in English)
6. Suggest pricing strategy (competitive price range in USD, considering $1 = 1,300 KRW)
7. Recommend hashtags for Shopee social selling
8. Analyze the weight information:
   - If the original KG value seems missing or obviously wrong, estimate a realistic weight in KG based on the product type and description.
   - Explain briefly why you chose that weight.
9. Analyze the raw option data and convert it into a Shopee-style variation structure:
   - Detect whether the product has 0, 1, or 2 option tiers (e.g., Color / Size).
   - For each tier, suggest the tier name (in English) and a list of option values.
   - Summarize any price differences and sold-out options.
10. Perform a basic risk screening:
    - Flag if the product is likely to contain liquid/gel, built-in battery, strong magnet, sharp blade, or other shipping-restricted materials.
    - Return short warning messages for any detected risks.

**Output Format (JSON only, no markdown):**
{
  "productNameEN": "English product name",
  "descriptionEN": "Detailed English description",
  "categories": ["Category 1", "Category 2", "Category 3"],
  "keywords": ["keyword1", "keyword2", "..."],
  "sellingPoints": ["Point 1", "Point 2", "Point 3"],
  "pricingStrategy": {
    "minUSD": 0,
    "maxUSD": 0,
    "recommendation": "pricing strategy explanation"
  },
  "hashtags": ["#tag1", "#tag2", "..."],
  "marketingTips": "Brief marketing advice for this product",
  "weight": {
    "originalKG": 0,
    "estimatedKG": 0,
    "isAdjusted": false,
    "reason": ""
  },
  "optionStructure": {
    "hasOptions": false,
    "tierCount": 0,
    "tier1Name": null,
    "tier1Values": [],
    "tier2Name": null,
    "tier2Values": [],
    "notes": ""
  },
  "riskFlags": {
    "hasBattery": false,
    "isLiquidOrGel": false,
    "isMagnet": false,
    "hasSharpObject": false,
    "otherRisks": [],
    "overallRiskComment": ""
  }
}

Respond with valid JSON only. Do not include any markdown formatting or code blocks.`;
}

/**
 * Gemini 응답을 파싱
 */
function parseGeminiResponse(responseText) {
  const defaultStructure = {
    productNameEN: "Translation Error",
    descriptionEN: "",
    categories: ["Others"],
    keywords: [],
    sellingPoints: [],
    pricingStrategy: { minUSD: 0, maxUSD: 0, recommendation: "N/A" },
    hashtags: [],
    marketingTips: "Please check the raw response in console.",
    weight: {
      originalKG: 0,
      estimatedKG: 0,
      isAdjusted: false,
      reason: "No analysis available",
    },
    optionStructure: {
      hasOptions: false,
      tierCount: 0,
      tier1Name: null,
      tier1Values: [],
      tier2Name: null,
      tier2Values: [],
      notes: "No option analysis available",
    },
    riskFlags: {
      hasBattery: false,
      isLiquidOrGel: false,
      isMagnet: false,
      hasSharpObject: false,
      otherRisks: [],
      overallRiskComment: "No risk screening available",
    },
  };

  try {
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText
        .replace(/^```json\s*/, "")
        .replace(/\s*```$/, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const rawParsed = JSON.parse(cleanedText);

    // 기본 구조와 응답 JSON을 merge 해서 최대한 살려 쓰기
    const parsed = {
      ...defaultStructure,
      ...rawParsed,
      weight: {
        ...defaultStructure.weight,
        ...(rawParsed.weight || {}),
      },
      optionStructure: {
        ...defaultStructure.optionStructure,
        ...(rawParsed.optionStructure || {}),
      },
      riskFlags: {
        ...defaultStructure.riskFlags,
        ...(rawParsed.riskFlags || {}),
      },
    };

    // 필수 필드가 없으면 에러 대신 경고만 찍기
    const requiredFields = [
      "productNameEN",
      "descriptionEN",
      "categories",
      "keywords",
    ];
    for (const field of requiredFields) {
      if (!parsed[field]) {
        console.warn("[Gemini] 응답 JSON에 필수 필드가 없습니다:", field);
      }
    }

    return parsed;
  } catch (error) {
    console.error("❌ [Gemini] 응답 파싱 실패:", error);
    console.log("원본 응답:", responseText);

    // fallback: JSON 파싱이 안 되면 descriptionEN에 원문 일부만 넣어서라도 UI를 깨지 않게 함
    return {
      ...defaultStructure,
      descriptionEN: responseText.substring(0, 300),
    };
  }
}

/**
 * API 키 가져오기 (Chrome Storage)
 */
async function getGeminiApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["geminiApiKey"], (result) => {
      resolve(result.geminiApiKey || GEMINI_API_KEY);
    });
  });
}

/**
 * API 키 저장하기
 */
async function saveGeminiApiKey(apiKey) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
      console.log("✅ [Gemini] API 키 저장 완료");
      resolve(true);
    });
  });
}

/**
 * API 키 테스트 (상세 결과 객체 반환)
 */
async function testGeminiApiKey(apiKey) {
  try {
    console.log("🔑 [Gemini] Endpoint:", GEMINI_API_ENDPOINT);
    console.log(
      "🔑 [Gemini] Testing key prefix:",
      apiKey.slice(0, 8) + "..."
    );

    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Hello, this is a test.",
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100,
          responseMimeType: "application/json",
        },
      }),
    });

    console.log(
      "🔍 [Gemini] 키 테스트 HTTP 응답 - Status:",
      response.status,
      "StatusText:",
      response.statusText
    );

    const rawText = await response.text();
    let errorMessage = "";

    if (!response.ok) {
      try {
        const json = JSON.parse(rawText);
        errorMessage = json.error?.message || rawText;
      } catch {
        errorMessage = rawText;
      }
      console.error(
        "❌ [Gemini] 키 테스트 실패 - Status:",
        response.status,
        "Error:",
        errorMessage
      );
    } else {
      console.log(
        "✅ [Gemini] 키 테스트 성공 - 응답:",
        rawText.substring(0, 100)
      );
    }

    if (response.ok) {
      return { ok: true, status: response.status };
    }

    return {
      ok: false,
      status: response.status,
      errorMessage,
    };
  } catch (error) {
    console.error(
      "❌ [Gemini] API 키 테스트 실패 (네트워크/CORS 오류 가능):",
      error
    );
    return {
      ok: false,
      status: null,
      errorMessage: error.message || "Unknown error",
    };
  }
}

console.log("🤖 Gemini API 모듈 로드 완료");
