// storage.js - K-finder-claude (Final Fix)

// 전역 상태 하나로 통일
let savedProducts = [];

async function initializeStorage() {
    console.log('🔧 Storage 초기화 시작...');
    await loadSavedProducts();
    bindStorageEvents();
    console.log('✅ Storage 초기화 완료');
}

async function loadSavedProducts() {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
            savedProducts = Object.entries(items)
                .filter(([key]) => key.startsWith('product_'))
                .map(([key, value]) => ({ id: key, ...value }))
                .sort((a, b) => new Date(b.저장시각) - new Date(a.저장시각));
            
            console.log(`📦 로드됨: ${savedProducts.length}개`);
            renderProductGrid();
            updateStats();
            resolve(savedProducts);
        });
    });
}

function renderProductGrid() {
    const productGrid = document.getElementById('productGrid');
    if (!productGrid) return;

    if (savedProducts.length === 0) {
        productGrid.innerHTML = `<div class="empty-state"><div class="icon">📦</div><p>저장된 상품 없음</p></div>`;
        return;
    }

    productGrid.innerHTML = savedProducts.map((p) => `
        <div class="product-card" data-id="${p.id}">
            <div class="product-card-actions">
                <button class="card-action-btn load-btn">📥</button>
                <button class="card-action-btn delete-btn">🗑️</button>
            </div>
            <img class="product-thumbnail" src="${p.대표이미지 || ''}" onerror="this.src='data:image/svg+xml,<svg...>'">
            <h4 class="product-card-name">${p.물품명 || 'No Name'}</h4>
            <div class="product-card-price">${p.판매가 || '-'}</div>
            <div class="product-card-meta"><span>${p.브랜드 || '-'}</span><span>${p.무게 || '-'}kg</span></div>
        </div>
    `).join('');

    bindCardEvents();
}

function bindCardEvents() {
    const grid = document.getElementById('productGrid');
    grid.onclick = (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        const id = card.dataset.id;

        if (e.target.classList.contains('load-btn')) {
            const p = savedProducts.find(item => item.id === id);
            // popup.js의 fillFields 함수 호출
            if (typeof fillFields !== 'undefined') {
                fillFields(p);
            }
            // 상품 추출 탭으로 전환
            document.querySelector('.tab-btn[data-tab="register"]')?.click();
        } else if (e.target.classList.contains('delete-btn')) {
            if(confirm('삭제하시겠습니까?')) deleteProduct(id);
        }
    };
}

async function deleteProduct(id) {
    await chrome.storage.local.remove(id);
    await loadSavedProducts();
}

async function clearAllProducts() {
    if (!confirm('전체 삭제하시겠습니까?')) return;
    const keys = savedProducts.map(p => p.id);
    await chrome.storage.local.remove(keys);
    await loadSavedProducts();
}

function updateStats() {
    const total = document.getElementById('totalCount');
    if (total) total.textContent = savedProducts.length;
}

function exportToCSV() {
    if (savedProducts.length === 0) {
        alert('데이터가 없습니다.');
        return;
    }
    const headers = ['소싱날짜', '소싱처', '상품코드', '물품명', '브랜드', '무게', '구입가', '판매가', '배송비'];
    const csvContent = [
        headers.join(','),
        ...savedProducts.map(p => 
            headers.map(h => `"${(p[h] || '').toString().replace(/"/g, '""')}"`).join(',')
        )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Shopee_Sourcing_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
}

// 이벤트 리스너
function bindStorageEvents() {
    document.getElementById('clearAllBtn')?.addEventListener('click', clearAllProducts);
    // 필요한 경우 CSV 내보내기 버튼 연결
    // document.getElementById('exportBtn')?.addEventListener('click', exportToCSV);
}

document.addEventListener('DOMContentLoaded', initializeStorage);