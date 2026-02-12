import { supabase } from '../services/supabase.js';

export async function getDailyReport(targetDate = null) {
    // Adjust for Bolivia Timezone (UTC-4) if no date provided
    let startDate, endDate;

    if (targetDate && targetDate.length === 7) { // YYYY-MM
        const [year, month] = targetDate.split('-');
        startDate = `${year}-${month}-01`;
        // Get last day of month
        const d = new Date(year, month, 0);
        endDate = `${year}-${month}-${d.getDate()}`;
    } else {
        startDate = targetDate || new Date(new Date().getTime() - (4 * 60 * 60 * 1000)).toISOString().split('T')[0];
        endDate = startDate; // Single day
    }

    // Next day for query range (exclusive)
    const queryEndDetails = new Date(new Date(endDate).getTime() + (24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    // 1. Fetch Orders (Completed only)
    const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('status', 'completed')
        .gte('created_at', startDate + 'T00:00:00')
        .lt('created_at', queryEndDetails + 'T00:00:00');

    // 2. Fetch Expenses (Daily & Fixed)
    const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', startDate + 'T00:00:00')
        .lt('created_at', queryEndDetails + 'T00:00:00');

    let dailyExpenses = 0;
    let fixedExpenses = 0;
    if (expenses) {
        expenses.forEach(e => {
            const amt = parseFloat(e.amount) || 0;
            if (e.expense_type === 'daily') dailyExpenses += amt;
            if (e.expense_type === 'fixed') fixedExpenses += amt;
        });
    }

    // 3. Fetch Products for Cost Analysis
    const { data: allProducts } = await supabase.from('products').select('id, name, cost');
    const productMap = {};
    if (allProducts) allProducts.forEach(p => productMap[String(p.id)] = p);

    // Calculations
    let totalSales = 0;
    let totalCost = 0;
    const productSales = {};
    let salesCash = 0;
    let salesDigital = 0;
    let salesPending = 0;

    if (orders) {
        orders.forEach(order => {
            const amount = order.total_amount || 0;
            totalSales += amount;

            const pm = (order.payment_method || 'cash').toLowerCase();
            if (pm === 'cash' || pm === 'efectivo') salesCash += amount;
            else if (pm === 'qr') salesDigital += amount;
            else salesPending += amount;

            if (order.order_items) {
                order.order_items.forEach(item => {
                    const q = parseInt(item.quantity) || 1;
                    const p = productMap[String(item.product_id)];
                    if (p) {
                        totalCost += (parseFloat(p.cost) || 0) * q;
                        productSales[p.name] = (productSales[p.name] || 0) + q;
                    }
                });
            }
        });
    }

    const grossProfit = totalSales - totalCost;
    const netProfit = grossProfit - dailyExpenses - fixedExpenses;

    const topProducts = Object.entries(productSales)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

    return {
        totalSales,
        totalCost,
        profit: netProfit,
        ordersCount: orders?.length || 0,
        customerCount: orders?.length || 0,
        topProducts,
        paymentBreakdown: { cash: salesCash, digital: salesDigital, pending: salesPending },
        expenses: { daily: dailyExpenses, fixed: fixedExpenses, list: expenses || [] },
        orders: orders || [],
        productMap
    };
}

export async function renderReports(container, dateParam = null) {
    const currentReportDate = dateParam || new Date(new Date().getTime() - (4 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const report = await getDailyReport(currentReportDate);

    // UI Handlers
    window.loadReportForDate = (val) => {
        renderReports(container, val);
    };

    container.innerHTML = `
    <div class="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in bg-gray-50/50 min-h-screen">
      
      <!-- TOP BAR -->
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div>
            <h2 class="text-3xl font-black text-gray-800 tracking-tight">Reporte Financiero</h2>
            <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Análisis de Ventas y Rendimiento</p>
          </div>
          
          <div class="flex flex-wrap items-center gap-4">
              <div class="flex bg-gray-100 p-1 rounded-xl">
                  <button onclick="document.getElementById('date-input').type='date'" class="px-4 py-2 text-[10px] font-black uppercase rounded-lg hover:bg-white transition shadow-sm">Hoy</button>
                  <button onclick="document.getElementById('date-input').type='month'" class="px-4 py-2 text-[10px] font-black uppercase rounded-lg hover:bg-white transition shadow-sm">Mes</button>
              </div>
              <input type="${currentReportDate.length === 7 ? 'month' : 'date'}" 
                     id="date-input"
                     value="${currentReportDate}" 
                     onchange="window.loadReportForDate(this.value)"
                     class="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold focus:ring-2 focus:ring-black outline-none transition" />
              <button onclick="setView('reports')" class="bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-black transition">Actualizar</button>
          </div>
      </div>

      <!-- KPI CARDS -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 border-l-8 border-l-blue-500">
              <p class="text-[10px] font-black text-gray-400 uppercase mb-1">Ventas Totales</p>
              <p class="text-2xl font-black text-gray-800">Bs. ${report.totalSales.toFixed(2)}</p>
          </div>
          <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 border-l-8 border-l-red-500">
              <p class="text-[10px] font-black text-gray-400 uppercase mb-1">Costo Mercancía</p>
              <p class="text-2xl font-black text-gray-800">Bs. ${report.totalCost.toFixed(2)}</p>
          </div>
          <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 border-l-8 border-l-orange-500">
              <p class="text-[10px] font-black text-gray-400 uppercase mb-1">Gastos Totales</p>
              <p class="text-2xl font-black text-gray-800">Bs. ${(report.expenses.daily + report.expenses.fixed).toFixed(2)}</p>
          </div>
          <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 border-l-8" style="border-left-color: ${report.profit >= 0 ? '#10b981' : '#ef4444'}">
              <p class="text-[10px] font-black text-gray-400 uppercase mb-1">Utilidad Neta</p>
              <p class="text-2xl font-black ${report.profit >= 0 ? 'text-green-600' : 'text-red-600'}">Bs. ${report.profit.toFixed(2)}</p>
          </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- LEFT: PRODUCTS & PAYMENTS -->
          <div class="lg:col-span-2 space-y-8">
              <!-- TOP PRODUCTS -->
              <div class="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                  <h3 class="text-lg font-black text-gray-800 mb-6 uppercase tracking-tight">Productos Estrella</h3>
                  <div class="space-y-4">
                      ${report.topProducts.map(p => {
        const percent = (p.qty / (report.topProducts[0]?.qty || 1)) * 100;
        return `
                          <div class="space-y-1">
                              <div class="flex justify-between text-sm font-bold">
                                  <span class="text-gray-600">${p.name}</span>
                                  <span>${p.qty} u.</span>
                              </div>
                              <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div class="h-full bg-black rounded-full" style="width: ${percent}%"></div>
                              </div>
                          </div>
                         `;
    }).join('') || '<p class="text-center text-gray-400 py-8 italic font-medium">No se registraron ventas aún.</p>'}
                  </div>
              </div>

              <!-- ORDER LIST -->
              <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div class="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                      <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest">Detalle de Transacciones</h3>
                      <span class="text-[10px] font-black bg-black text-white px-3 py-1 rounded-full">${report.ordersCount} PEDIDOS</span>
                  </div>
                  <div class="overflow-x-auto">
                      <table class="w-full text-left">
                          <thead class="text-[10px] font-black text-gray-400 uppercase border-b border-gray-50">
                              <tr>
                                  <th class="p-4">ID</th>
                                  <th class="p-4">Cliente</th>
                                  <th class="p-4">Pago</th>
                                  <th class="p-4 text-right">Total</th>
                              </tr>
                          </thead>
                          <tbody class="text-sm">
                              ${report.orders.map(o => `
                                  <tr class="border-b border-gray-50 hover:bg-gray-50 transition">
                                      <td class="p-4 font-mono text-xs text-gray-400">#${String(o.id).slice(-4)}</td>
                                      <td class="p-4 font-bold text-gray-700 capitalize">${(o.customer_name || 'Anónimo').toLowerCase()}</td>
                                      <td class="p-4">
                                          <span class="text-[10px] font-black uppercase px-2 py-1 rounded bg-gray-100 text-gray-500">${o.payment_method}</span>
                                      </td>
                                      <td class="p-4 text-right font-black text-gray-800">Bs. ${o.total_amount.toFixed(2)}</td>
                                  </tr>
                              `).join('') || '<tr><td colspan="4" class="p-8 text-center text-gray-400 italic font-medium">Sin datos para esta fecha.</td></tr>'}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>

          <!-- RIGHT: EXPENSES & METHODS -->
          <div class="space-y-8">
              <!-- PAYMENT METHODS -->
              <div class="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                  <h3 class="text-lg font-black text-gray-800 mb-6 uppercase tracking-tight">Métodos de Cobro</h3>
                  <div class="space-y-6">
                      <div class="flex items-center justify-between">
                          <div>
                              <p class="text-[10px] font-black text-gray-400 uppercase">Efectivo Total</p>
                              <p class="text-xl font-black text-gray-800">Bs. ${report.paymentBreakdown.cash.toFixed(2)}</p>
                          </div>
                          <span class="text-2xl">💵</span>
                      </div>
                      <div class="flex items-center justify-between">
                          <div>
                              <p class="text-[10px] font-black text-gray-400 uppercase">Transferencia / QR</p>
                              <p class="text-xl font-black text-gray-800">Bs. ${report.paymentBreakdown.digital.toFixed(2)}</p>
                          </div>
                          <span class="text-2xl">📱</span>
                      </div>
                  </div>
              </div>

              <!-- EXPENSE BREAKDOWN -->
              <div class="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                  <div class="flex justify-between items-center mb-6">
                      <h3 class="text-lg font-black text-gray-800 uppercase tracking-tight">Gastos</h3>
                      <button onclick="window.openExpenseModal()" class="text-[10px] bg-black text-white px-3 py-1.5 rounded-xl font-black hover:bg-gray-800 transition"> + GASTO</button>
                  </div>
                  <div class="space-y-4">
                      <div class="flex justify-between p-4 bg-orange-50 rounded-2xl">
                          <span class="text-xs font-black text-orange-600 uppercase">Variabes (Día)</span>
                          <span class="font-black text-orange-700">Bs. ${report.expenses.daily.toFixed(2)}</span>
                      </div>
                      <div class="flex justify-between p-4 bg-red-50 rounded-2xl">
                          <span class="text-xs font-black text-red-600 uppercase">Fijos (Mes)</span>
                          <span class="font-black text-red-700">Bs. ${report.expenses.fixed.toFixed(2)}</span>
                      </div>
                      
                      <div class="pt-4 border-t border-gray-100">
                          <p class="text-[10px] font-black text-gray-300 uppercase mb-3">Últimas Salidas</p>
                          <div class="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              ${report.expenses.list.map(e => `
                                  <div class="flex justify-between text-xs font-medium">
                                      <span class="text-gray-500 truncate w-32">${e.description}</span>
                                      <span class="text-gray-800 font-bold">- Bs. ${parseFloat(e.amount).toFixed(2)}</span>
                                  </div>
                              `).join('') || '<p class="text-[10px] italic text-gray-300">No hay gastos registrados.</p>'}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
   `;
}
