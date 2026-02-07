import { supabase } from '../services/supabase.js';
import { store } from '../store.js';

export async function checkOpenSession() {
  // Check if current user has an open session
  const { data, error } = await supabase
    .from('cash_register')
    .select('*')
    .is('closed_at', null)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    store.currentSession = data;
    return true; // Session exists
  }
  return false; // No open session
}

export async function openRegister(initialCash) {
  const { data, error } = await supabase
    .from('cash_register')
    .insert({
      initial_cash: parseFloat(initialCash),
      opened_at: new Date().toISOString(),
      status: 'open'
    })
    .select()
    .single();

  if (data) {
    store.currentSession = data;
    return data;
  }
  if (error) throw error;
}

export async function closeRegister(details) {
  // details: { finalCash, expectedCash, difference, salesCash, salesDigital, ... }
  if (!store.currentSession) return;

  const { data, error } = await supabase
    .from('cash_register')
    .update({
      closed_at: new Date().toISOString(),
      final_cash: parseFloat(details.finalCash),
      expected_cash: parseFloat(details.expectedCash),
      difference: parseFloat(details.difference),
      total_sales_cash: parseFloat(details.salesCash),
      total_sales_digital: parseFloat(details.salesDigital),
      status: 'closed'
    })
    .eq('id', store.currentSession.id)
    .select()
    .single();

  if (data) {
    store.currentSession = null;
    return data;
  }
  if (error) {
    console.error('Error closing register:', error);
    alert('Error al cerrar caja en BD: ' + error.message);
  }
}

export async function addCashMove(type, amount, reason) {
  if (!store.currentSession) return;

  const { data, error } = await supabase
    .from('cash_moves')
    .insert({
      cash_register_id: store.currentSession.id,
      type, // 'withdrawal' or 'deposit'
      amount: parseFloat(amount),
      reason,
      performed_by: store.user.role === 'admin' ? 'Admin' : 'Cajero'
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding cash move:', error);
    throw error;
  }
  return data;
}

export function renderCloseArqueoModal(report, initialCash) {
  const expected = (initialCash + report.paymentBreakdown.cash).toFixed(2);

  return `
    <div id="close-modal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Cierre y Arqueo de Caja</h2>
        
        <div class="bg-gray-50 p-4 rounded-lg mb-6 text-sm">
           <div class="flex justify-between mb-1">
             <span>Monto Inicial:</span>
             <span class="font-bold">Bs. ${initialCash.toFixed(2)}</span>
           </div>
           <div class="flex justify-between mb-1">
             <span>+ Ventas Efectivo:</span>
             <span class="font-bold text-green-600">Bs. ${report.paymentBreakdown.cash.toFixed(2)}</span>
           </div>
           <div class="flex justify-between mb-1 text-gray-500">
             <span>+ Ventas QR/Digital:</span>
             <span class="font-bold">Bs. ${report.paymentBreakdown.digital.toFixed(2)}</span>
           </div>
           <div class="border-t border-gray-300 my-2"></div>
           <div class="flex justify-between text-lg font-bold text-blue-900">
             <span>DINERO ESPERADO:</span>
             <span id="expected-cash-display">Bs. ${expected}</span>
           </div>
        </div>

        <div class="mb-6">
          <label class="block text-sm font-bold text-gray-700 mb-2">Dinero Real en Caja (Cuéntalo)</label>
          <input type="number" id="actual-cash-input" class="w-full text-3xl p-3 border-2 border-primary rounded-lg focus:outline-none text-right font-bold text-gray-800" placeholder="0.00">
          <p class="text-xs text-gray-500 mt-1 text-right">Ingresa la suma de billetes y monedas</p>
        </div>
        
        <div id="diff-preview" class="mb-6 text-center hidden">
           <p class="text-sm font-bold">Diferencia:</p>
           <p class="text-xl font-bold" id="diff-amount">--</p>
        </div>
        
        <div class="flex gap-3">
            <button id="cancel-close-btn" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-lg transition">
              Cancelar
            </button>
            <button id="confirm-close-btn" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition">
              CERRAR TURNO
            </button>
        </div>
      </div>
    </div>
  `;
}

export function renderCashModal() {
  // Returns HTML for the modal
  return `
    <div id="cash-modal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-8 max-w-sm w-full shadow-2xl">
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Apertura de Caja</h2>
        <p class="text-gray-600 mb-6">Ingresa el monto inicial para comenzar el turno.</p>
        
        <div class="mb-6">
          <label class="block text-sm font-bold text-gray-700 mb-2">Monto Inicial (Bs)</label>
          <input type="number" id="initial-cash-input" class="w-full text-2xl p-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none" value="0.00">
        </div>
        
        <button id="open-register-btn" class="w-full bg-primary hover:bg-orange-600 text-white font-bold py-4 rounded-lg transition text-lg">
          ABRIR CAJA
        </button>
      </div>
    </div>
  `;
}
