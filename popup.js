// popup.js - K-finder-claude Shopee 최적화 UI

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 K-finder-claude Shopee UI 초기화');

    // UI 요소들
    const extractBtn = document.getElementById('extractBtn');
    const saveProductBtn = document.getElementById('saveProductBtn');
    const statusEl = document.getElementById('status');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const debugEl = document.getElementById('debugInfo');
    const imageContainer = document.getElementById('imageContainer');
    const debugToggleBtn = document.getElementById('debugToggleBtn');

    // 전역 데이터
    window.currentProductData = {};

    // ========== 유틸리티 함수 ==========
    const log = (msg, data) => {
        const ts = new Date().toLocaleTimeString();
        let detail = '';
        if (typeof data !== 'undefined') {
            detail = ': ' + (typeof data === 'string' ? data : JSON.stringify(data));
        }
        const line = `[${ts}] ${msg}${detail}`;
        console.log(line);
        if (debugEl) {
            debugEl.textContent += line + '\n';
            debugEl.scrollTop = debugEl.scrollHeight;
        }
    };

    const updateProgress = (value) => {
        progressContainer.style.display = 'block';
        progressBar.style.width = `${value}%`;
    };

    const hideProgress = () => {
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
        }, 500);
    };

    const updateStatus = (message, type = 'default') => {
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
    };

    // ========== 필드 채우기 (Shopee 최적화) ==========
    // storage.js에서도 접근 가능하도록 window에 할당
    window.fillFields = (data) => {
        // Shopee 필수 필드
        const shopeeFields = [
            "소싱날짜", "소싱처", "상품코드", "상품URL",
            "물품명", "브랜드", "무게",
            "구입가", "판매가", "재고수량",
            "배송비", "제조사", "원산지", "원산지세부",
            "어린이제품인증정보", "전기용품인증정보", "생활용품인증정보", "방송통신기자재인증정보"
        ];

        // 판매가 자동 계산 (마진율 적용)
        if (data.구입가 && !data.판매가) {
            const marginRate = parseInt(document.getElementById('marginRate')?.value) || 30;
            const purchasePrice = parseFloat(data.구입가.replace(/[^0-9]/g, ''));

            if (purchasePrice > 0) {
                const calculatedPrice = purchasePrice * (1 + marginRate / 100);
                const finalPrice = Math.ceil(calculatedPrice / 100) * 100;
                data.판매가 = finalPrice.toLocaleString() + '원';
                log('판매가 자동 계산', data.판매가);
            }
        }

        // 필드 업데이트
        shopeeFields.forEach(key => {
            const el = document.getElementById(key);
            if (el) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.value = data[key] || '';
                } else {
                    el.textContent = data[key] || '';
                }
            }
        });

        window.currentProductData = data;

        // 옵션 Raw Data 표시 (AI 분석용)
        displayRawOptions(data.상품옵션 || []);

        // 이미지 표시
        displayImages(data);
    };

    // ========== 옵션 배지 형태로 표시 (UI 개선) ==========
    const displayRawOptions = (rawOptions) => {
        const optionSection = document.getElementById('optionSection');
        const optionContainer = document.getElementById('optionContainer');

        if (!optionSection || !optionContainer) return;

        if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
            optionSection.style.display = 'none';
            log('옵션 없음');
            return;
        }

        optionSection.style.display = 'block';
        optionContainer.innerHTML = '';

        // 배지 형태로 옵션 표시
        rawOptions.forEach(group => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'option-group';

            // 그룹명
            const titleDiv = document.createElement('div');
            titleDiv.className = 'option-group-title';
            titleDiv.textContent = group.그룹명 || '옵션';
            groupDiv.appendChild(titleDiv);

            // 옵션 목록
            const listDiv = document.createElement('div');
            listDiv.className = 'option-list';

            if (group.항목 && Array.isArray(group.항목)) {
                group.항목.forEach(item => {
                    const badge = document.createElement('span');
                    badge.className = `option-badge${item.품절 ? ' soldout' : ''}`;
                    badge.textContent = item.라벨 || item.가격표시 || 'N/A';

                    // 가격 정보가 있으면 추가
                    if (item.가격표시 && item.가격표시 !== item.라벨) {
                        badge.textContent += ` (${item.가격표시})`;
                    }

                    listDiv.appendChild(badge);
                });
            }

            groupDiv.appendChild(listDiv);
            optionContainer.appendChild(groupDiv);
        });

        log('옵션 배지 표시', `${rawOptions.length}개 그룹`);
    };

    // ========== 이미지 표시 ==========
    const displayImages = (data) => {
        if (!imageContainer) return;

        imageContainer.innerHTML = '';

        // 대표이미지
        const thumbnails = (data.모든대표이미지 || data.대표이미지 || '').split('|').filter(Boolean);
        if (thumbnails.length > 0) {
            const thumbSection = document.createElement('div');
            thumbSection.className = 'image-section';
            thumbSection.innerHTML = `<div class="image-section-title">대표이미지 (${thumbnails.length}개)</div>`;

            const thumbGrid = document.createElement('div');
            thumbGrid.className = 'image-grid';

            thumbnails.forEach((url, idx) => {
                const imgWrapper = document.createElement('div');
                imgWrapper.className = 'image-item';

                const img = document.createElement('img');
                img.src = url;
                img.alt = `대표이미지 ${idx + 1}`;
                img.loading = 'lazy';
                img.onclick = () => window.open(url, '_blank');

                imgWrapper.appendChild(img);
                thumbGrid.appendChild(imgWrapper);
            });

            thumbSection.appendChild(thumbGrid);
            imageContainer.appendChild(thumbSection);
        }

        // 상세이미지
        const detailImages = (data.상세이미지 || '').split('|').filter(Boolean);
        if (detailImages.length > 0) {
            const detailSection = document.createElement('div');
            detailSection.className = 'image-section';
            detailSection.innerHTML = `<div class="image-section-title">상세이미지 (${detailImages.length}개)</div>`;

            const detailGrid = document.createElement('div');
            detailGrid.className = 'image-grid';

            detailImages.slice(0, 10).forEach((url, idx) => {
                const imgWrapper = document.createElement('div');
                imgWrapper.className = 'image-item';

                const img = document.createElement('img');
                img.src = url;
                img.alt = `상세이미지 ${idx + 1}`;
                img.loading = 'lazy';
                img.onclick = () => window.open(url, '_blank');

                imgWrapper.appendChild(img);
                detailGrid.appendChild(imgWrapper);
            });

            detailSection.appendChild(detailGrid);
            imageContainer.appendChild(detailSection);

            if (detailImages.length > 10) {
                const moreInfo = document.createElement('div');
                moreInfo.className = 'image-info';
                moreInfo.textContent = `... 외 ${detailImages.length - 10}개 더`;
                detailSection.appendChild(moreInfo);
            }
        }

        log('이미지 표시 완료', `대표 ${thumbnails.length}개, 상세 ${detailImages.length}개`);
    };

    // ========== 상품 추출 ==========
    extractBtn?.addEventListener('click', async () => {
        try {
            updateStatus('상품 정보를 추출하는 중...', 'processing');
            updateProgress(10);

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                throw new Error('현재 탭을 찾을 수 없습니다.');
            }

            log('상품 추출 시작', tab.url);
            updateProgress(30);

            const response = await chrome.runtime.sendMessage({
                action: 'extractProductInfo',
                tabId: tab.id
            });

            updateProgress(70);

            if (response?.error) {
                throw new Error(response.error);
            }

            log('추출 완료', '데이터 수신');
            window.fillFields(response);

            updateProgress(100);
            updateStatus('상품 정보 추출 완료!', 'success');
            hideProgress();

            // AI 분석 버튼 활성화
            const aiAnalyzeBtn = document.getElementById('aiAnalyzeBtn');
            if (aiAnalyzeBtn) {
                aiAnalyzeBtn.disabled = false;
            }

        } catch (error) {
            log('추출 실패', error.message);
            updateStatus(`오류: ${error.message}`, 'error');
            hideProgress();
        }
    });

    // ========== AI 분석 ==========
    const aiAnalyzeBtn = document.getElementById('aiAnalyzeBtn');
    aiAnalyzeBtn?.addEventListener('click', async () => {
        try {
            const data = window.currentProductData;

            if (!data || !data.물품명) {
                updateStatus('분석할 상품 정보가 없습니다. 먼저 페이지 스캔을 해주세요.', 'error');
                return;
            }

            // 버튼 비활성화 및 로딩 상태
            aiAnalyzeBtn.disabled = true;
            aiAnalyzeBtn.innerHTML = '<span class="icon">⏳</span><span>분석 중...</span>';
            updateStatus('AI가 상품을 분석하는 중...', 'processing');
            updateProgress(30);

            log('AI 분석 시작', data.물품명);

            // Gemini API 호출
            const result = await analyzeProductForShopee(data);

            updateProgress(70);

            if (result.error) {
                throw new Error(result.message);
            }

            log('AI 분석 완료');
            renderAIResult(result.data);

            updateProgress(100);
            updateStatus('✨ AI 분석 완료! Shopee 최적화 데이터를 확인하세요.', 'success');
            hideProgress();

            // 버튼 복구
            aiAnalyzeBtn.innerHTML = '<span class="number">2</span><span class="icon">✨</span><span>AI 분석</span>';
            aiAnalyzeBtn.disabled = false;

        } catch (error) {
            log('AI 분석 실패', error.message);
            updateStatus(`AI 분석 오류: ${error.message}`, 'error');
            hideProgress();

            // 버튼 복구
            aiAnalyzeBtn.innerHTML = '<span class="number">2</span><span class="icon">✨</span><span>AI 분석</span>';
            aiAnalyzeBtn.disabled = false;
        }
    });

    // ========== AI 결과 렌더링 ==========
    const renderAIResult = (aiData) => {
        const resultSection = document.getElementById('aiResultSection');
        const resultContainer = document.getElementById('aiResultContainer');

        if (!resultSection || !resultContainer) return;

        // AI 분석 결과를 currentProductData에 저장 (3단계에서 재사용)
        window.currentProductData.aiShopeeAnalysis = aiData;
        log('AI 분석 결과 저장됨', 'currentProductData.aiShopeeAnalysis');

        resultSection.style.display = 'block';
        resultContainer.innerHTML = '';

        // 영문 상품명
        const nameDiv = document.createElement('div');
        nameDiv.style.marginBottom = '15px';
        nameDiv.innerHTML = `
            <div style="font-weight: 700; font-size: 12px; color: #667eea; margin-bottom: 5px;">📝 English Product Name</div>
            <div style="padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 13px; font-weight: 600;">${aiData.productNameEN || 'N/A'}</div>
        `;
        resultContainer.appendChild(nameDiv);

        // 영문 설명
        const descDiv = document.createElement('div');
        descDiv.style.marginBottom = '15px';
        descDiv.innerHTML = `
            <div style="font-weight: 700; font-size: 12px; color: #667eea; margin-bottom: 5px;">📄 Product Description</div>
            <div style="padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 11px; line-height: 1.6; white-space: pre-wrap;">${aiData.descriptionEN || 'N/A'}</div>
        `;
        resultContainer.appendChild(descDiv);

        // 카테고리 추천
        if (aiData.categories && aiData.categories.length > 0) {
            const catDiv = document.createElement('div');
            catDiv.style.marginBottom = '15px';
            catDiv.innerHTML = `
                <div style="font-weight: 700; font-size: 12px; color: #667eea; margin-bottom: 5px;">📂 Recommended Categories</div>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    ${aiData.categories.map(cat => `<span style="padding: 4px 10px; background: #667eea; color: white; border-radius: 12px; font-size: 10px;">${cat}</span>`).join('')}
                </div>
            `;
            resultContainer.appendChild(catDiv);
        }

        // 키워드
        if (aiData.keywords && aiData.keywords.length > 0) {
            const keyDiv = document.createElement('div');
            keyDiv.style.marginBottom = '15px';
            keyDiv.innerHTML = `
                <div style="font-weight: 700; font-size: 12px; color: #667eea; margin-bottom: 5px;">🔍 SEO Keywords</div>
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    ${aiData.keywords.map(kw => `<span style="padding: 4px 8px; background: #e9ecef; border: 1px solid #dee2e6; border-radius: 8px; font-size: 10px;">${kw}</span>`).join('')}
                </div>
            `;
            resultContainer.appendChild(keyDiv);
        }

        // 판매 포인트
        if (aiData.sellingPoints && aiData.sellingPoints.length > 0) {
            const pointDiv = document.createElement('div');
            pointDiv.style.marginBottom = '15px';
            pointDiv.innerHTML = `
                <div style="font-weight: 700; font-size: 12px; color: #667eea; margin-bottom: 5px;">⭐ Key Selling Points</div>
                <ul style="margin: 0; padding-left: 20px; font-size: 11px; line-height: 1.8;">
                    ${aiData.sellingPoints.map(point => `<li>${point}</li>`).join('')}
                </ul>
            `;
            resultContainer.appendChild(pointDiv);
        }

        // 가격 전략
        if (aiData.pricingStrategy) {
            const priceDiv = document.createElement('div');
            priceDiv.style.marginBottom = '15px';
            priceDiv.innerHTML = `
                <div style="font-weight: 700; font-size: 12px; color: #667eea; margin-bottom: 5px;">💰 Pricing Strategy</div>
                <div style="padding: 10px; background: #fff3cd; border-radius: 6px; font-size: 11px;">
                    <strong>Recommended Range:</strong> $${aiData.pricingStrategy.minUSD} - $${aiData.pricingStrategy.maxUSD}<br>
                    <span style="color: #856404;">${aiData.pricingStrategy.recommendation || ''}</span>
                </div>
            `;
            resultContainer.appendChild(priceDiv);
        }

        // 해시태그
        if (aiData.hashtags && aiData.hashtags.length > 0) {
            const hashDiv = document.createElement('div');
            hashDiv.style.marginBottom = '15px';
            hashDiv.innerHTML = `
                <div style="font-weight: 700; font-size: 12px; color: #667eea; margin-bottom: 5px;">#️⃣ Hashtags</div>
                <div style="font-size: 11px; color: #667eea;">${aiData.hashtags.join(' ')}</div>
            `;
            resultContainer.appendChild(hashDiv);
        }

        // 마케팅 팁
        if (aiData.marketingTips) {
            const tipDiv = document.createElement('div');
            tipDiv.style.marginBottom = '15px';
            tipDiv.innerHTML = `
                <div style="font-weight: 700; font-size: 12px; color: #667eea; margin-bottom: 5px;">💡 Marketing Tips</div>
                <div style="padding: 10px; background: #d1ecf1; border-radius: 6px; font-size: 11px; color: #0c5460;">${aiData.marketingTips}</div>
            `;
            resultContainer.appendChild(tipDiv);
        }

        // 무게 보정 정보
        if (aiData.weight) {
            const weightDiv = document.createElement('div');
            weightDiv.style.marginBottom = '15px';
            const isAdjusted = aiData.weight.isAdjusted;
            const bgColor = isAdjusted ? '#fff3cd' : '#e8f5e9';
            const icon = isAdjusted ? '⚠️' : '✅';
            weightDiv.innerHTML = `
                <div style="font-weight: 700; font-size: 12px; color: #667eea; margin-bottom: 5px;">${icon} Weight Analysis</div>
                <div style="padding: 10px; background: ${bgColor}; border-radius: 6px; font-size: 11px;">
                    <strong>Original:</strong> ${aiData.weight.originalKG} kg<br>
                    <strong>Estimated:</strong> ${aiData.weight.estimatedKG} kg<br>
                    ${isAdjusted ? `<strong>⚠️ Adjusted:</strong> ${aiData.weight.reason}` : `<span style="color: #2e7d32;">Weight seems reasonable</span>`}
                </div>
            `;
            resultContainer.appendChild(weightDiv);

            // TODO: 무게 필드에 추천값 반영 기능 추가 예정
            if (isAdjusted && aiData.weight.estimatedKG > 0) {
                log('AI 추천 무게', `${aiData.weight.estimatedKG} kg (기존: ${aiData.weight.originalKG} kg)`);
                // 향후: document.getElementById('무게').value = aiData.weight.estimatedKG;
            }
        }

        // 옵션 구조화 정보
        if (aiData.optionStructure) {
            const optDiv = document.createElement('div');
            optDiv.style.marginBottom = '15px';
            const hasOpts = aiData.optionStructure.hasOptions;
            optDiv.innerHTML = `
                <div style="font-weight: 700; font-size: 12px; color: #667eea; margin-bottom: 5px;">🎨 Option Structure</div>
                <div style="padding: 10px; background: ${hasOpts ? '#e3f2fd' : '#f8f9fa'}; border-radius: 6px; font-size: 11px;">
                    <strong>Has Options:</strong> ${hasOpts ? 'Yes' : 'No'}<br>
                    ${hasOpts ? `
                        <strong>Tier Count:</strong> ${aiData.optionStructure.tierCount}<br>
                        ${aiData.optionStructure.tier1Name ? `<strong>Tier 1:</strong> ${aiData.optionStructure.tier1Name} (${aiData.optionStructure.tier1Values.join(', ')})<br>` : ''}
                        ${aiData.optionStructure.tier2Name ? `<strong>Tier 2:</strong> ${aiData.optionStructure.tier2Name} (${aiData.optionStructure.tier2Values.join(', ')})<br>` : ''}
                    ` : ''}
                    <span style="color: #6c757d;">${aiData.optionStructure.notes}</span>
                </div>
            `;
            resultContainer.appendChild(optDiv);
        }

        // 리스크 필터링 정보
        if (aiData.riskFlags) {
            const risks = [];
            if (aiData.riskFlags.hasBattery) risks.push('⚡ Battery');
            if (aiData.riskFlags.isLiquidOrGel) risks.push('💧 Liquid/Gel');
            if (aiData.riskFlags.isMagnet) risks.push('🧲 Magnet');
            if (aiData.riskFlags.hasSharpObject) risks.push('🔪 Sharp Object');
            risks.push(...aiData.riskFlags.otherRisks);

            const hasRisk = risks.length > 0;
            const riskDiv = document.createElement('div');
            riskDiv.innerHTML = `
                <div style="font-weight: 700; font-size: 12px; color: ${hasRisk ? '#dc3545' : '#28a745'}; margin-bottom: 5px;">${hasRisk ? '⚠️' : '✅'} Shipping Risk Screening</div>
                <div style="padding: 10px; background: ${hasRisk ? '#f8d7da' : '#d4edda'}; border-radius: 6px; font-size: 11px; color: ${hasRisk ? '#721c24' : '#155724'};">
                    ${hasRisk ? `
                        <strong>Detected Risks:</strong><br>
                        ${risks.map(r => `• ${r}`).join('<br>')}
                        <br><br>
                        <strong>Comment:</strong> ${aiData.riskFlags.overallRiskComment}
                    ` : `
                        <strong>No shipping restrictions detected</strong><br>
                        <span>${aiData.riskFlags.overallRiskComment}</span>
                    `}
                </div>
            `;
            resultContainer.appendChild(riskDiv);
        }

        log('AI 결과 렌더링 완료');
    };

    // ========== 상품 저장 ==========
    saveProductBtn?.addEventListener('click', async () => {
        try {
            const data = window.currentProductData;

            if (!data || !data.물품명) {
                updateStatus('저장할 상품 정보가 없습니다.', 'error');
                return;
            }

            // 현재 입력 필드의 값들로 업데이트
            const updateFields = [
                "물품명", "브랜드", "무게", "구입가", "판매가",
                "배송비", "제조사", "원산지", "원산지세부", "재고수량"
            ];

            updateFields.forEach(key => {
                const el = document.getElementById(key);
                if (el && el.value) {
                    data[key] = el.value;
                }
            });

            // 저장 ID 생성
            const saveId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            data.저장ID = saveId;
            data.저장시각 = new Date().toISOString();

            // Chrome Storage에 저장
            await chrome.storage.local.set({ [saveId]: data });

            log('상품 저장 완료', saveId);
            updateStatus('상품이 저장되었습니다!', 'success');

            // 저장 목록 갱신 (storage.js의 함수 호출)
            if (typeof loadSavedProducts === 'function') {
                loadSavedProducts();
            }

        } catch (error) {
            log('저장 실패', error.message);
            updateStatus(`저장 오류: ${error.message}`, 'error');
        }
    });

    // ========== 디버그 토글 ==========
    debugToggleBtn?.addEventListener('click', () => {
        if (debugEl) {
            debugEl.style.display = debugEl.style.display === 'none' ? 'block' : 'none';
        }
    });

    // ========== 탭 전환 ==========
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;

            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            e.target.classList.add('active');
            document.getElementById(`${targetTab}-tab`)?.classList.add('active');

            if (targetTab === 'list') {
                // storage.js의 loadSavedProducts 호출
                if (typeof loadSavedProducts === 'function') {
                    loadSavedProducts();
                }
            }
        });
    });

    // ========== Gemini API 키 관리 ==========
    const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
    const saveGeminiKeyBtn = document.getElementById('saveGeminiKeyBtn');
    const geminiKeyStatus = document.getElementById('geminiKeyStatus');

    // API 키 초기화 (저장된 키 불러오기)
    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            geminiApiKeyInput.value = result.geminiApiKey;
            geminiKeyStatus.textContent = '✅ 저장됨';
            geminiKeyStatus.style.color = '#28a745';
        } else {
            geminiKeyStatus.textContent = '⚠️ 미설정';
            geminiKeyStatus.style.color = '#dc3545';
        }
    });

    // API 키 저장 & 테스트 (결과 객체 버전)
    saveGeminiKeyBtn?.addEventListener('click', async () => {
        const apiKey = geminiApiKeyInput.value.trim();

        if (!apiKey) {
            geminiKeyStatus.textContent = '❌ 키 입력 필요';
            geminiKeyStatus.style.color = '#dc3545';
            alert('API 키를 입력해주세요.');
            return;
        }

        try {
            // 로딩 상태 표시
            saveGeminiKeyBtn.disabled = true;
            saveGeminiKeyBtn.textContent = '테스트 중...';
            geminiKeyStatus.textContent = '⏳ 검증 중...';
            geminiKeyStatus.style.color = '#ffc107';

            // API 키 저장
            await saveGeminiApiKey(apiKey);
            log('Gemini API 키 저장 완료');

            // API 키 테스트 (결과 객체)
            const result = await testGeminiApiKey(apiKey);

            if (result.ok) {
                geminiKeyStatus.textContent = '✅ 키 유효';
                geminiKeyStatus.style.color = '#28a745';
                updateStatus('Gemini API 키가 저장되고 검증되었습니다.', 'success');
                log('Gemini API 키 검증 성공');
            } else {
                // HTTP 상태코드에 따라 메시지 세분화
                geminiKeyStatus.textContent = '❌ 키 테스트 실패';
                geminiKeyStatus.style.color = '#dc3545';

                let uiMessage = 'Gemini API 키 테스트에 실패했습니다. 콘솔 로그를 확인해주세요.';

                if (result.status === 401 || result.status === 403) {
                    uiMessage = `API 키 또는 프로젝트 권한 문제일 수 있습니다. (HTTP ${result.status}: ${result.errorMessage || ''})`;
                } else if (result.status === 404) {
                    uiMessage = `엔드포인트 또는 모델 이름이 올바른지 확인해주세요. (HTTP 404: ${result.errorMessage || ''})`;
                } else if (result.status === 429) {
                    uiMessage = `쿼터 또는 rate limit을 초과했을 수 있습니다. (HTTP 429: ${result.errorMessage || ''})`;
                } else if (result.status >= 500 && result.status < 600) {
                    uiMessage = `Gemini 서버 측 오류입니다. 잠시 후 다시 시도해주세요. (HTTP ${result.status})`;
                } else if (result.status === null) {
                    uiMessage = `네트워크 또는 CORS/CSP 문제일 수 있습니다: ${result.errorMessage || ''}`;
                } else if (result.status) {
                    uiMessage = `HTTP ${result.status} 오류: ${result.errorMessage || ''}`;
                }

                updateStatus(uiMessage, 'error');
                log('Gemini API 키 검증 실패', JSON.stringify(result));
            }
        } catch (error) {
            geminiKeyStatus.textContent = '❌ 오류';
            geminiKeyStatus.style.color = '#dc3545';
            updateStatus(`API 키 저장/검증 중 오류: ${error.message}`, 'error');
            log('Gemini API 키 저장/검증 오류', error.message);
        } finally {
            // 버튼 복구
            saveGeminiKeyBtn.disabled = false;
            saveGeminiKeyBtn.textContent = '저장 & 테스트';
        }
    });

    // ========== 초기화 ==========
    log('Shopee 최적화 UI 준비 완료');
    updateStatus('준비 완료. 상품 페이지에서 "페이지 스캔" 버튼을 눌러주세요.');
});
