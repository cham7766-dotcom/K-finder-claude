// background.js - K-finder-claude Shopee 최적화 버전 (Scope 오류 수정)

// 확장 프로그램 아이콘 클릭시 사이드 패널 열기
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractProductInfo') {
        handleExtractProductInfo(sender.tab?.id || request.tabId)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (request.action === 'getCurrentTab') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            sendResponse({ tab: tabs[0] });
        });
        return true;
    }
});

// 상품 정보 추출 핸들러
async function handleExtractProductInfo(tabId) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const targetTabId = tabId || tab?.id;

        if (!targetTabId) {
            throw new Error('탭을 찾을 수 없습니다.');
        }

        const url = tab?.url || '';
        console.log('🔍 추출 대상 URL:', url);

        // 쇼핑몰 판별 및 추출 함수 선택
        let extractFunction;

        // 현재 버전은 쿠팡/네이버 스마트스토어/브랜드만 지원
        if (url.includes('coupang.com')) {
            extractFunction = extractCoupangShopee;
        } else if (url.includes('smartstore.naver.com') || url.includes('brand.naver.com')) {
            extractFunction = extractNaverShopee;
        } else {
            throw new Error('지원하지 않는 쇼핑몰입니다. (쿠팡/네이버 스마트스토어/브랜드만 지원)');
        }

        // 페이지에서 스크립트 실행
        const results = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            func: extractFunction
        });

        if (results && results[0] && results[0].result) {
            console.log('✅ 추출 완료:', results[0].result);
            return results[0].result;
        }

        throw new Error('상품 정보를 추출할 수 없습니다.');

    } catch (error) {
        console.error('❌ 추출 오류:', error);
        throw error;
    }
}

// ==================== 쿠팡 Shopee 최적화 ====================
function extractCoupangShopee() {
    // 헬퍼 함수 내장 (Scope 오류 해결)
    function extractWeight(title, description = '') {
        const text = (title + ' ' + description).toLowerCase();
        const patterns = [
            /([0-9.]+)\s*(kg|킬로그램)/i,
            /([0-9.]+)\s*(g|그램)(?!ram)/i,
            /([0-9.]+)\s*(ml|밀리리터)/i,
            /([0-9.]+)\s*(l|리터)(?!iter)/i
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                let value = parseFloat(match[1]);
                const unit = match[2].toLowerCase();
                if (unit.includes('g') || unit.includes('ml')) value = value / 1000;
                return value.toFixed(2);
            }
        }
        return '0.50'; // 기본값
    }

    function upgradeImageUrl(url) {
        if (!url) return '';
        url = url.replace(/\/thumbnail\//, '/492x492ex/');
        url = url.replace(/\/48x48ex\//, '/492x492ex/');
        url = url.replace(/\/70x70ex\//, '/492x492ex/');
        url = url.replace(/\/96x96ex\//, '/492x492ex/');
        return url;
    }

    try {
        const data = {};

        // 1) 기본 정보
        data.상품URL = location.href;
        let itemId = new URL(location.href).searchParams.get('itemId') || '';
        if (!itemId) {
            const descEls = document.querySelectorAll('.product-description li, .prod-description li');
            for (const el of descEls) {
                const t = el.textContent || '';
                if (t.includes('쿠팡상품번호:')) {
                    const m = t.match(/쿠팡상품번호:\s*(\d+)/);
                    if (m) { itemId = m[1]; break; }
                }
            }
        }
        data.상품코드 = itemId;
        data.소싱날짜 = new Date().toISOString().split('T')[0];
        data.소싱처 = 'coupang';

        // 2) 물품명
        const titleEl =
            document.querySelector('h1.product-title span.twc-font-bold')
            || document.querySelector('h2.prod-buy-header__title')
            || document.querySelector('h2[data-test="productTitle"]');
        data.물품명 = titleEl?.textContent.trim() || '';

        // 3) 무게 추출
        data.무게 = extractWeight(data.물품명);

        // 4) 브랜드 추출
        const brandEl = document.querySelector('.prod-brand-name a, [class*="brand"]');
        data.브랜드 = brandEl?.textContent.trim() || 'No Brand';

        // 5) 가격
        const priceEl =
            document.querySelector('.simplify-atf-price .twc-font-bold[class*="28px"]')
            || document.querySelector('.sales-price-amount')
            || document.querySelector('.final-price-amount');
        const priceNum = parseInt((priceEl?.textContent || '').replace(/[^\d]/g, ''), 10) || 0;
        data.구입가 = priceNum ? `${priceNum.toLocaleString()}원` : '0원';

        // 6) 대표이미지 (URL만, Base64 제외)
        const thumbs = [];
        const thumbEls = document.querySelectorAll(
            '.product-image img, .twc-w-\\[70px\\] img, .prod-thumbnail img, .thumbnail-list img'
        );
        thumbEls.forEach(img => {
            let src = img.getAttribute('src')?.trim() || '';
            if (!src || src.startsWith('data:')) return;
            if (src.startsWith('//')) src = 'https:' + src;
            src = upgradeImageUrl(src);
            if (!thumbs.includes(src) && /coupangcdn\.com/.test(src)) {
                thumbs.push(src);
            }
        });

        const mainImg = document.querySelector('img.prod-thumbnail__image, img[data-test="productMainImage"]');
        if (mainImg) {
            let m = mainImg.getAttribute('src')?.trim() || '';
            if (m && !m.startsWith('data:')) {
                if (m.startsWith('//')) m = 'https:' + m;
                m = upgradeImageUrl(m);
                if (!thumbs.includes(m)) thumbs.unshift(m);
            }
        }

        data.대표이미지 = thumbs[0] || '';
        data.모든대표이미지 = thumbs.join('|');

        // 7) 상세이미지 (URL만)
        const detailEls = Array.from(document.querySelectorAll([
            '#prodDetail img',
            '.prod-description img',
            '.detail-content img',
            '.product-detail-content-new img'
        ].join(', ')));
        const detailUrls = detailEls.map(el => {
            let src = el.getAttribute('data-src') || el.getAttribute('src') || '';
            if (!src || src.startsWith('data:')) return '';
            if (src.startsWith('//')) src = 'https:' + src;
            return src;
        }).filter(Boolean);
        data.상세이미지 = detailUrls.join('|');

        // 8) 옵션 (Raw Data) - AI 분석용
        const rawOptions = [];
        const optionBlocks = document.querySelectorAll('.option-picker-select, .option-table-v2');
        optionBlocks.forEach((block, idx) => {
            const groupName = block.querySelector('.twc-flex-1')?.textContent.trim() || `옵션${idx + 1}`;
            const items = [];

            // 드롭다운 항목
            block.querySelectorAll('.select-item').forEach(li => {
                const label = li.querySelector('.twc-font-bold')?.textContent.trim() || '';
                const priceText = li.querySelector('.price-text')?.textContent.trim() || '';
                const soldOut = li.classList.contains('disabled') || /품절/.test(li.textContent);
                if (label) items.push({ 라벨: label, 가격표시: priceText, 품절: soldOut });
            });

            // 테이블 행
            block.querySelectorAll('.option-table-list__option').forEach(row => {
                const label = row.querySelector('.option-table-list__option-name')?.textContent.trim() || '';
                const priceText = row.querySelector('.option-table-list__option-price')?.textContent.trim() || '';
                const soldOut = row.classList.contains('disabled') || /품절/.test(row.textContent);
                if (label) items.push({ 라벨: label, 가격표시: priceText, 품절: soldOut });
            });

            if (items.length) rawOptions.push({ 그룹명: groupName, 항목: items });
        });
        data.상품옵션 = rawOptions;

        // 9) 인증 정보
        document.querySelectorAll('#itemBrief table tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            for (let i = 0; i < cells.length; i += 2) {
                const key = cells[i]?.textContent.trim() || '';
                const value = cells[i + 1]?.textContent.trim() || '';

                if (/KC.*전기용품|전기용품.*KC/i.test(key)) {
                    data.전기용품인증정보 = value;
                } else if (/KC.*어린이|어린이.*KC/i.test(key)) {
                    data.어린이제품인증정보 = value;
                } else if (/KC.*생활용품|생활용품.*KC/i.test(key)) {
                    data.생활용품인증정보 = value;
                } else if (/방송통신|전파인증|KCC/i.test(key)) {
                    data.방송통신기자재인증정보 = value;
                } else if (/제조자|제조사|수입자/.test(key)) {
                    data.제조사 = value;
                } else if (/제조국|원산지/.test(key)) {
                    data.원산지세부 = value;
                }
            }
        });

        // 기본값
        data.판매단위 = 'EA';
        data.배송비 = '3000';

        return data;
    } catch (err) {
        return { error: err.message };
    }
}

// ==================== 네이버 Shopee 최적화 ====================
function extractNaverShopee() {
    // 헬퍼 함수 내장
    function extractWeight(title, description = '') {
        const text = (title + ' ' + description).toLowerCase();
        const patterns = [
            /([0-9.]+)\s*(kg|킬로그램)/i,
            /([0-9.]+)\s*(g|그램)(?!ram)/i,
            /([0-9.]+)\s*(ml|밀리리터)/i,
            /([0-9.]+)\s*(l|리터)(?!iter)/i
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                let value = parseFloat(match[1]);
                const unit = match[2].toLowerCase();
                if (unit.includes('g') || unit.includes('ml')) value = value / 1000;
                return value.toFixed(2);
            }
        }
        return '0.50';
    }

    function upgradeImageUrl(url) {
        if (!url) return '';
        url = url.replace(/type=f40/, 'type=f640');
        url = url.replace(/type=f80/, 'type=f640');
        url = url.replace(/type=f200/, 'type=f640');
        return url;
    }

    try {
        const data = {};

        data.상품URL = location.href;
        const urlMatch = location.href.match(/\/products\/(\d+)/);
        data.상품코드 = urlMatch ? urlMatch[1] : '';
        data.소싱날짜 = new Date().toISOString().split('T')[0];
        data.소싱처 = location.href.includes('brand.naver.com') ? 'naverbrand' : 'naversmart';

        // 물품명
        const titleElement = document.querySelector('h3.DCVBehA8ZB, .product_title h3');
        data.물품명 = titleElement?.textContent?.trim() || '';

        // 무게
        data.무게 = extractWeight(data.물품명);

        // 브랜드
        const brandEl = document.querySelector('.product_article ._2L3vDuo0YM a, [class*="brand"]');
        data.브랜드 = brandEl?.textContent.trim() || 'No Brand';

        // 가격
        const priceElement = document.querySelector('.Xu9MEKUuIo.s6EKUu28OE .e1DMQNBPJ_, .price em');
        const priceNum = parseInt((priceElement?.textContent || '').replace(/[^\d]/g, ''), 10) || 0;
        data.구입가 = priceNum ? `${priceNum.toLocaleString()}원` : '0원';

        // 배송비
        const shippingElement = document.querySelector('span.Se0UVy4E71, .delivery_fee');
        data.배송비 = (shippingElement?.textContent || '').replace(/[^\d]/g, '') || '0';

        // 대표이미지 (URL만)
        const thumbnailImages = [];
        const mainImg = document.querySelector('img.bd_2DO68, .image_thumb img');
        if (mainImg && mainImg.src && !mainImg.src.startsWith('data:')) {
            thumbnailImages.push(upgradeImageUrl(mainImg.src));
        }

        const thumbElements = document.querySelectorAll('img.bd_1Niq0, .thumbnail img');
        thumbElements.forEach((img) => {
            if (img.src && !img.src.startsWith('data:') && img.src.includes('shop-phinf.pstatic.net')) {
                const improved = upgradeImageUrl(img.src);
                const baseUrl = improved.split('?')[0];
                const isDuplicate = thumbnailImages.some(existingUrl =>
                    existingUrl.split('?')[0] === baseUrl
                );
                if (!isDuplicate) thumbnailImages.push(improved);
            }
        });

        data.대표이미지 = thumbnailImages[0] || '';
        data.모든대표이미지 = thumbnailImages.slice(0, 8).join('|');

        // 상세이미지 (URL만)
        const detailImages = [];
        const smartEditorImages = document.querySelectorAll('.se-image-resource, .se-module-image img, .detail_content img');
        smartEditorImages.forEach(img => {
            const src = img.getAttribute('src') || img.getAttribute('data-src');
            if (src && !src.startsWith('data:') && src.includes('shop-phinf.pstatic.net')) {
                detailImages.push(src);
            }
        });
        data.상세이미지 = detailImages.slice(0, 15).join('|');

        // 옵션 (Raw Data)
        const rawOptions = [];
        const optionGroups = document.querySelectorAll('.product_option_area ul, .optionArea ul');
        optionGroups.forEach((group, idx) => {
            const items = [];
            group.querySelectorAll('li').forEach(li => {
                const label = li.textContent.trim();
                const soldOut = li.classList.contains('disabled') || /품절/.test(label);
                if (label) items.push({ 라벨: label, 품절: soldOut });
            });
            if (items.length) rawOptions.push({ 그룹명: `옵션${idx + 1}`, 항목: items });
        });
        data.상품옵션 = rawOptions;

        // 기본값
        data.판매단위 = 'EA';

        return data;
    } catch (err) {
        return { error: err.message };
    }
}

// ==================== 지마켓 Shopee 최적화 ====================
// ==================== 도매 사이트 함수 제거됨 ====================
// 1단계 스코프: 쿠팡/네이버 스마트스토어/브랜드만 지원
// 지마켓, 도매꾹, 오너클랜, 스페셜B2B 관련 함수는 향후 필요시 추가

console.log('🚀 K-finder-claude Shopee 최적화 버전 로드 완료');