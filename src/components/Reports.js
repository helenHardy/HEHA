import { supabase } from '../services/supabase.js';

export async function getDailyReport(targetDate = null) {
  // Adjust for Bolivia Timezone (UTC-4) if no date provided
  const today = targetDate || new Date(new Date().getTime() - (4 * 60 * 60 * 1000)).toISOString().split('T')[0];
  const nextDay = new Date(new Date(today).getTime() + (24 * 60 * 60 * 1000)).toISOString().split('T')[0];

  // 1. Fetch Orders and Items (without products deep join)
  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('status', 'completed')
    .gte('created_at', today + 'T00:00:00')
    .lt('created_at', nextDay + 'T00:00:00');

  // 1.b Fetch Cash Moves (Withdrawals)
  const { data: moves } = await supabase
    .from('cash_moves')
    .select('*')
    .gte('created_at', today + 'T00:00:00')
    .lt('created_at', nextDay + 'T00:00:00');

  let totalWithdrawals = 0;
  if (moves) {
    moves.forEach(m => {
      if (m.type === 'withdrawal') totalWithdrawals += parseFloat(m.amount);
      // if (m.type === 'deposit') totalWithdrawals -= parseFloat(m.amount); // Optional logic
    });
  }

  if (!orders || orders.length === 0) return null;

  // 2. Fetch All Products (to get costs reliably)
  // We fetch ALL products to ensure we have the cost data for every item sold.
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, cost');

  // Create Map for quick lookup:  id -> { cost, name }
  const productMap = {};
  if (allProducts) {
    allProducts.forEach(p => {
      // Normalize ID to string to ensure matching works regardless of type (int/string)
      productMap[String(p.id)] = p;
    });
  }

  let totalSales = 0;
  let totalCost = 0;
  const productSales = {};
  let customerCount = orders.length;

  // Payment Breakdown
  let salesCash = 0;
  let salesDigital = 0; // QR
  let salesPending = 0;

  orders.forEach(order => {
    // Use total_amount from order for sales
    const amount = order.total_amount || 0;
    totalSales += amount;

    // Payment Method Analysis
    const pm = (order.payment_method || 'cash').toLowerCase();

    // Consider 'cash' and 'efectivo' as money in drawer.
    // 'qr' goes to bank (digital).
    // 'pendiente' is debt (not in drawer, potentially not in bank yet).
    if (pm === 'cash' || pm === 'efectivo') {
      salesCash += amount;
    } else if (pm === 'qr') {
      salesDigital += amount;
    } else {
      salesPending += amount; // 'pendiente' or others
    }

    if (order.order_items) {
      order.order_items.forEach(item => {
        const q = parseInt(item.quantity) || 1; // Default to 1 if null
        const pid = String(item.product_id); // Normalize to string for lookup

        // Manual lookup
        const product = productMap[pid];

        if (product) {
          const cost = parseFloat(product.cost) || 0;
          totalCost += (cost * q);

          // Aggregation for Top Products
          if (!productSales[product.name]) productSales[product.name] = 0;
          productSales[product.name] += q;
        } else {
          // Fallback if product deleted or not found
          // Only warn if it's not a known deleted item situation
          if (pid !== 'undefined' && pid !== 'null') {
            console.warn('Producto no encontrado ID:', pid);
          }
        }
      });
    }
  });

  const profit = totalSales - totalCost;

  // Sort Top Products
  const topProducts = Object.entries(productSales)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty) // Sort by quantity desc
    .slice(0, 10); // Show top 10

  return {
    totalSales,
    totalCost,
    profit,
    customerCount,
    topProducts,
    paymentBreakdown: {
      cash: salesCash,
      digital: salesDigital,
      pending: salesPending
    },
    totalWithdrawals: totalWithdrawals || 0,
    // Debug Data
    debug: {
      orders,
      productMap
    }
  };
}

export async function renderReports(container, dateParam = null) {
  // Default to today if no param
  const currentReportDate = dateParam || new Date(new Date().getTime() - (4 * 60 * 60 * 1000)).toISOString().split('T')[0];

  const report = await getDailyReport(currentReportDate) || {
    totalSales: 0,
    totalCost: 0,
    profit: 0,
    customerCount: 0,
    topProducts: [],
    paymentBreakdown: { cash: 0, digital: 0, pending: 0 },
    totalWithdrawals: 0
  };

  // expose helper for UI
  window.loadReportForDate = (val) => {
    const mainContainer = document.getElementById('main-content'); // Assuming main container id
    // We need to re-call this render function. 
    // Since renderReports returns a string (innerHTML), we need to handle the update.
    // However, usually `setView` calls this. 
    // Let's assume we can re-render by calling renderReports again if we had the container.
    // Instead, filtering usually implies re-rendering the view.
    // We'll update the global store or just re-render into the known container if passed, or rely on a global reload.
    // For simplicity, let's update a global state or force a re-render.
    // BETTER: Just call the view updater if existing.
    if (window.setView) {
      // We might need to modify setView to potentially pass params, or store it in a global var.
      // Let's assume we can store the date in a global var temporarily or just re-render content.
      // Since setView is simple, we'll implement a custom re-renderer here.
      renderReports(document.getElementById('app-content') || document.body, val).then(html => {
        (document.getElementById('app-content') || document.body).innerHTML = html;
      });
    }
  };

  const maxQty = report.topProducts.length > 0 ? report.topProducts[0].qty : 1;
  const totalByMethod = (report.paymentBreakdown.cash + report.paymentBreakdown.digital + report.paymentBreakdown.pending) || 1;

  const getPercent = (val) => ((val / totalByMethod) * 100).toFixed(1);

  return `
    <div class="space-y-10 animate-fade-in pb-20">
      <!-- Header -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 class="text-4xl font-black text-gray-800 tracking-tight">Reporte de Ventas</h2>
            <p class="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Resumen de operaciones del día</p>
          </div>
          <div class="flex gap-3">
             <div class="relative">
                <input type="date" value="${currentReportDate}" 
                       onchange="window.loadReportForDate(this.value)"
                       class="px-4 py-3 rounded-2xl border border-gray-100 shadow-sm text-xs font-black uppercase tracking-widest text-gray-600 focus:outline-none focus:border-black transition" />
             </div>
             <button onclick="setView('reports')" class="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition" title="Recargar">🔄</button>
             <button onclick="handleCloseRegister()" class="bg-black text-white px-6 py-3 rounded-2xl shadow-xl shadow-black/20 hover:scale-[1.02] transition active:scale-95 font-black text-xs uppercase tracking-widest">
               Cerrar Caja
             </button>
          </div>
      </div>
      
      <!-- KPI Cards Premium -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="bg-gradient-to-br from-primary to-orange-600 p-8 rounded-[2.5rem] shadow-xl shadow-primary/20 text-white transform hover:-translate-y-1 transition duration-500">
          <p class="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Ingresos Brutos</p>
          <p class="text-3xl font-black mb-1">Bs. ${(report.totalSales || 0).toFixed(2)}</p>
          <div class="w-12 h-1 bg-white/30 rounded-full"></div>
        </div>
        
        <div class="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 transform hover:-translate-y-1 transition duration-500">
          <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Costo Invertido</p>
          <p class="text-3xl font-black text-gray-800 mb-1">Bs. ${(report.totalCost || 0).toFixed(2)}</p>
          <div class="w-12 h-1 bg-blue-500 rounded-full"></div>
        </div>

        <div class="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 transform hover:-translate-y-1 transition duration-500">
          <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Ganancia Neta</p>
          <p class="text-3xl font-black text-green-500 mb-1">Bs. ${(report.profit || 0).toFixed(2)}</p>
          <div class="w-12 h-1 bg-green-500 rounded-full"></div>
        </div>

        <div class="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 transform hover:-translate-y-1 transition duration-500">
          <p class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Pedidos Totales</p>
          <p class="text-3xl font-black text-gray-800 mb-1">${report.customerCount}</p>
          <div class="w-12 h-1 bg-purple-500 rounded-full"></div>
        </div>
      </div>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
         <!-- Top Products con Barras -->
         <div class="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
            <div class="flex justify-between items-center mb-8">
               <h3 class="font-black text-xl text-gray-800 tracking-tight">Platos Más Vendidos</h3>
               <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">Top 10</span>
            </div>
            <div class="space-y-6">
              ${report.topProducts.map((p, i) => `
                <div class="space-y-2 group">
                   <div class="flex justify-between items-center">
                      <div class="flex items-center gap-3">
                        <span class="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:bg-primary group-hover:text-white transition-colors">${i + 1}</span>
                        <span class="text-sm font-bold text-gray-700 capitalize">${p.name.toLowerCase()}</span>
                      </div>
                      <span class="text-sm font-black text-gray-800">${p.qty} <span class="text-[10px] text-gray-400 uppercase">u.</span></span>
                   </div>
                   <div class="h-2 bg-gray-50 rounded-full overflow-hidden">
                      <div class="h-full bg-primary rounded-full transition-all duration-1000" style="width: ${(p.qty / maxQty) * 100}%"></div>
                   </div>
                </div>
              `).join('') || '<div class="py-10 text-center text-gray-300 italic">No hay datos de ventas hoy.</div>'}
            </div>
         </div>
         
         <!-- Métodos de Pago Visual -->
         <div class="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col">
            <h3 class="font-black text-xl text-gray-800 tracking-tight mb-8">Métodos de Pago</h3>
            
            <div class="flex-1 flex flex-col justify-center space-y-8">
               <div class="space-y-4">
                  <div class="flex justify-between items-end">
                     <div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Efectivo (Caja)</p>
                        <p class="text-2xl font-black text-gray-800">Bs. ${(report.paymentBreakdown?.cash || 0).toFixed(2)}</p>
                     </div>
                     <span class="text-xs font-black text-gray-300">${getPercent(report.paymentBreakdown.cash)}%</span>
                  </div>
                  <div class="h-3 bg-gray-50 rounded-full overflow-hidden">
                     <div class="h-full bg-green-400 rounded-full" style="width: ${getPercent(report.paymentBreakdown.cash)}%"></div>
                  </div>
               </div>

               <div class="space-y-4">
                  <div class="flex justify-between items-end">
                     <div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Digital (QR/Transferencia)</p>
                        <p class="text-2xl font-black text-gray-800">Bs. ${(report.paymentBreakdown?.digital || 0).toFixed(2)}</p>
                     </div>
                     <span class="text-xs font-black text-gray-300">${getPercent(report.paymentBreakdown.digital)}%</span>
                  </div>
                  <div class="h-3 bg-gray-50 rounded-full overflow-hidden">
                     <div class="h-full bg-blue-400 rounded-full" style="width: ${getPercent(report.paymentBreakdown.digital)}%"></div>
                  </div>
               </div>

               <div class="space-y-4">
                  <div class="flex justify-between items-end">
                     <div>
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pendiente (A Cobrar)</p>
                        <p class="text-2xl font-black text-gray-800">Bs. ${(report.paymentBreakdown?.pending || 0).toFixed(2)}</p>
                     </div>
                     <span class="text-xs font-black text-gray-300">${getPercent(report.paymentBreakdown.pending)}%</span>
                  </div>
                  <div class="h-3 bg-gray-50 rounded-full overflow-hidden">
                     <div class="h-full bg-orange-400 rounded-full" style="width: ${getPercent(report.paymentBreakdown.pending)}%"></div>
                  </div>
               </div>
            </div>

            <div class="mt-10 p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
               <div class="flex justify-between items-center">
                  <p class="text-xs font-black text-gray-400 uppercase tracking-widest">Retiros de Caja</p>
                  <p class="text-lg font-black text-red-500">- Bs. ${(report.totalWithdrawals || 0).toFixed(2)}</p>
               </div>
            </div>
         </div>
      </div>
      
      <!-- Detalle Técnico Colapsable -->
      <div class="border-t border-gray-200 pt-10">
         <details class="group">
            <summary class="list-none cursor-pointer flex items-center gap-2 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] hover:text-gray-500 transition">
               <span class="group-open:rotate-90 transition-transform">▶</span>
               Ver Diagnóstico Técnico
            </summary>
            <div class="mt-4 p-8 bg-gray-900 rounded-[2rem] text-green-400 font-mono text-[10px] overflow-auto shadow-2xl">
               <p>> Analizando ${report.debug?.orders?.length || 0} órdenes completadas...</p>
               <p>> Costos calculados sobre ${report.debug?.productMap ? Object.keys(report.debug.productMap).length : 0} productos activos.</p>
               <p>> Inconsistencias: ${report.debug?.orders?.filter(o => !o.total_amount).length || 0} órdenes sin monto total.</p>
               <p class="mt-4 opacity-50">// RAW DATA SUMMARY</p>
               <pre class="mt-2">${JSON.stringify({ sales: report.totalSales, cost: report.totalCost, profit: report.profit }, null, 2)}</pre>
            </div>
         </details>
      </div>
    </div>
  `;
}
