import { getDailyReport } from './Reports.js';
import { store } from '../store.js';

export async function renderDashboard(container) {
    const report = await getDailyReport() || {
        totalSales: 0,
        totalCost: 0,
        profit: 0,
        customerCount: 0,
        topProducts: []
    };

    container.innerHTML = `
        <div class="space-y-8 animate-fade-in">
            <!-- Header Section -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                   <h2 class="text-4xl font-black text-gray-800 tracking-tight">¡Hola, ${store.user?.full_name?.split(' ')[0] || 'Cajero'}! 👋</h2>
                   <p class="text-gray-500 font-medium">Aquí tienes el resumen de hoy en tiempo real.</p>
                </div>
                <div class="bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
                    <span class="relative flex h-3 w-3">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span class="font-bold text-gray-700 text-sm uppercase tracking-widest">${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </div>
            </div>

            <!-- KPI Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-gradient-to-br from-primary to-orange-600 p-8 rounded-[2rem] shadow-xl text-white transform transition hover:scale-[1.02]">
                    <p class="text-orange-100 font-bold text-sm uppercase tracking-widest mb-1">Ventas Totales</p>
                    <h3 class="text-5xl font-black mb-4 flex items-baseline gap-2">
                        <span class="text-2xl font-medium opacity-80">Bs.</span>
                        ${report.totalSales.toFixed(2)}
                    </h3>
                    <div class="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                        <div class="bg-white h-full" style="width: 70%"></div>
                    </div>
                </div>

                ${store.user?.role === 'admin' ? `
                <div class="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 transform transition hover:scale-[1.02]">
                    <p class="text-gray-400 font-bold text-sm uppercase tracking-widest mb-1">Ganancia Neta</p>
                    <h3 class="text-5xl font-black text-green-600 mb-4 flex items-baseline gap-2">
                        <span class="text-2xl font-medium text-gray-400">Bs.</span>
                        ${report.profit.toFixed(2)}
                    </h3>
                    <span class="text-xs font-black bg-green-100 text-green-700 px-3 py-1 rounded-full">+12.5% vs ayer</span>
                </div>
                ` : ''}

                <div class="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 transform transition hover:scale-[1.02]">
                    <p class="text-gray-400 font-bold text-sm uppercase tracking-widest mb-1">Clientes</p>
                    <h3 class="text-5xl font-black text-gray-800 mb-4">
                        ${report.customerCount}
                    </h3>
                    <div class="flex -space-x-2">
                        <div class="w-8 h-8 rounded-full bg-blue-400 border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">JD</div>
                        <div class="w-8 h-8 rounded-full bg-orange-400 border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">MA</div>
                        <div class="w-8 h-8 rounded-full bg-purple-400 border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">RL</div>
                        <div class="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] text-gray-500 font-bold">+${Math.max(0, report.customerCount - 3)}</div>
                    </div>
                </div>
            </div>

            <!-- Main Dashboard Content -->
            <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <!-- Top Products (Left 3 cols) -->
                <div class="lg:col-span-3 bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
                    <div class="flex justify-between items-center mb-8">
                        <h3 class="text-2xl font-black text-gray-800">Menús Más Populares</h3>
                        <button onclick="setView('reports')" class="text-primary font-bold text-sm hover:underline italic">Ver reporte completo →</button>
                    </div>
                    
                    <div class="space-y-6">
                        ${report.topProducts.slice(0, 5).map((p, i) => `
                            <div class="flex items-center gap-6">
                                <span class="text-xl font-black text-gray-300 w-4">0${i + 1}</span>
                                <div class="flex-1">
                                    <div class="flex justify-between mb-2">
                                        <span class="font-bold text-gray-700">${p.name}</span>
                                        <span class="font-black text-gray-800">${p.qty}</span>
                                    </div>
                                    <div class="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
                                        <div class="bg-yellow-400 h-full rounded-full transition-all duration-1000" style="width: ${Math.min(100, (p.qty / (report.topProducts[0]?.qty || 1)) * 100)}%"></div>
                                    </div>
                                </div>
                            </div>
                        `).join('') || '<div class="py-10 text-center text-gray-400 font-medium">Aún no hay ventas registradas hoy.</div>'}
                    </div>
                </div>

                <!-- Quick Actions (Right 2 cols) -->
                <div class="lg:col-span-2 space-y-6">
                    <h3 class="text-2xl font-black text-gray-800">Accesos Rápidos</h3>
                    
                    <button onclick="window.openExpenseModal()" class="w-full group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition hover:bg-black hover:text-white transform hover:-translate-y-1">
                        <div class="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-2xl group-hover:bg-gray-800 transition">💸</div>
                        <div class="text-left flex-1">
                            <p class="font-black uppercase tracking-tighter text-lg leading-tight">Registrar Gasto</p>
                            <p class="text-xs text-gray-400 group-hover:text-gray-500">Salida de dinero (diario/fijo)</p>
                        </div>
                    </button>

                    <button onclick="setView('pos')" class="w-full group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition hover:bg-black hover:text-white transform hover:-translate-y-1">
                        <div class="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl group-hover:bg-gray-800 transition">🛒</div>
                        <div class="text-left">
                            <p class="font-black uppercase tracking-tighter text-lg leading-tight">Nueva Venta (POS)</p>
                            <p class="text-xs text-gray-400 group-hover:text-gray-500">Abrir terminal de ventas</p>
                        </div>
                    </button>

                    <button onclick="setView('kiosk-orders')" class="w-full group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition hover:bg-black hover:text-white transform hover:-translate-y-1">
                        <div class="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl group-hover:bg-gray-800 transition">🤖</div>
                        <div class="text-left flex-1">
                            <p class="font-black uppercase tracking-tighter text-lg leading-tight">Pedidos Kiosco</p>
                            <p class="text-xs text-gray-400 group-hover:text-gray-500">Aprobar pedidos pendientes</p>
                        </div>
                        <span id="dash-kiosk-badge" class="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full hidden">0</span>
                    </button>

                    <button onclick="setView('cash')" class="w-full group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition hover:bg-black hover:text-white transform hover:-translate-y-1">
                        <div class="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl group-hover:bg-gray-800 transition">💰</div>
                        <div class="text-left">
                            <p class="font-black uppercase tracking-tighter text-lg leading-tight">Gestión de Caja</p>
                            <p class="text-xs text-gray-400 group-hover:text-gray-500">Abrir/Cerrar sesión y arqueo</p>
                        </div>
                    </button>
                    
                    ${store.user?.role === 'admin' ? `
                    <button onclick="setView('reports')" class="w-full group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition hover:bg-black hover:text-white transform hover:-translate-y-1">
                        <div class="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl group-hover:bg-gray-800 transition">📊</div>
                        <div class="text-left">
                            <p class="font-black uppercase tracking-tighter text-lg leading-tight">Panel de Reportes</p>
                            <p class="text-xs text-gray-400 group-hover:text-gray-500">Ver estadísticas detalladas</p>
                        </div>
                    </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    // Sync badge
    const badge = document.getElementById('kiosk-order-badge');
    const dashBadge = document.getElementById('dash-kiosk-badge');
    if (badge && dashBadge && !badge.classList.contains('hidden')) {
        dashBadge.innerText = badge.innerText;
        dashBadge.classList.remove('hidden');
    }
}
