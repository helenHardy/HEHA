import { store } from '../store.js';

export function renderBranchSelector(container) {
    const branches = store.branches;
    const activeId = store.activeBranchId;

    if (!branches || branches.length === 0) {
        container.innerHTML = '';
        return;
    }

    // If only one branch and not admin, just show the name
    if (branches.length === 1 && store.user?.role !== 'admin') {
        container.innerHTML = `
            <div class="flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary rounded-2xl border border-primary/10">
                <span class="text-lg">📍</span>
                <span class="font-black text-xs uppercase tracking-widest">${branches[0].name}</span>
            </div>
        `;
        return;
    }

    // Dropdown for multiple branches or Admin
    container.innerHTML = `
        <div class="relative group">
            <button class="flex items-center gap-3 px-5 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-100 transition-all group-hover:border-primary/30">
                <span class="text-xl">📍</span>
                <div class="text-left hidden sm:block">
                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1">Sucursal Activa</p>
                    <p class="font-black text-sm text-gray-800 tracking-tight leading-none">${store.activeBranch?.name || 'Seleccionar...'}</p>
                </div>
                <span class="text-gray-400 text-xs transition-transform group-hover:rotate-180">▼</span>
            </button>
            
            <div class="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-3 z-[100] opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300">
                <div class="px-5 py-2 mb-2 border-b border-gray-50">
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cambiar Sucursal</p>
                </div>
                <div class="max-h-64 overflow-y-auto scrollbar-hide">
                    ${branches.map(branch => `
                        <button onclick="window.switchBranch(${branch.id})" 
                                class="w-full flex items-center justify-between px-5 py-3 hover:bg-primary/5 transition-colors group/item">
                            <div class="text-left">
                                <p class="font-bold text-gray-800 ${branch.id == activeId ? 'text-primary' : ''}">${branch.name}</p>
                                <p class="text-[10px] text-gray-400 font-medium">${branch.city || 'La Paz'}</p>
                            </div>
                            ${branch.id == activeId ? '<span class="text-primary text-xl">✓</span>' : ''}
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Global helper for switching
    window.switchBranch = (id) => {
        store.setActiveBranch(id);
        // Refresh the whole app to re-fetch data based on the new branch
        window.location.reload(); 
    };
}
