import './style.css';
import { supabase } from './services/supabase.js';
import { store } from './store.js';
import { generateReceiptHTML, printTicket, generateCloseReportHTML } from './utils/printer.js';
import { generateWhatsAppMessage } from './utils/whatsapp.js';
import { checkOpenSession, renderCashModal, openRegister, closeRegister, renderCloseArqueoModal, addCashMove } from './components/CashRegister.js';
import { renderReports, getDailyReport } from './components/Reports.js';
import { renderProductManager } from './components/ProductManager.js';
import { renderKiosk } from './components/Kiosk.js';
import { renderDashboard } from './components/Dashboard.js';

// Basic Router State
let currentView = 'dashboard'; // dashboard, pos, reports, products, users, orders, kiosk-orders, cash

const app = document.querySelector('#app');

// Update Kiosk Badge 
async function updateKioskBadge() {
  const badge = document.getElementById('kiosk-order-badge');
  if (!badge) return;

  const { count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .eq('cashier_name', 'Kiosco');

  if (!error && count > 0) {
    badge.innerText = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}
setInterval(updateKioskBadge, 10000); // Check every 10s

// Play notification sound
function playNotificationSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
  oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.5); // A4

  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}

// REALTIME: Listen for new Kiosk orders
let kioskSubscription = null;
function setupKioskRealtime() {
  if (kioskSubscription) return;

  console.log("🔌 Iniciando canal de Realtime para Kiosco...");

  kioskSubscription = supabase
    .channel('kiosk-orders-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: 'status=eq.pending'
      },
      (payload) => {
        const newOrder = payload.new;
        if (newOrder.cashier_name === 'Kiosco') {
          console.log("🔔 ¡Nuevo pedido recibido del Kiosco!", newOrder);

          playNotificationSound();
          updateKioskBadge();
          showToast(`🤖 Nuevo pedido de <b>${newOrder.customer_name || 'Cliente'}</b>`, 'success');

          // If current view is kiosk-orders, refresh list
          if (currentView === 'kiosk-orders') {
            const pageContent = document.getElementById('page-content');
            if (pageContent) renderKioskManagerView(pageContent);
          }
        }
      }
    )
    .subscribe();
}


// --- GLOBALS & HELPERS ---
window.handleLogout = async () => {
  await store.logout();
  render();
};

window.showToast = (message, type = 'success') => {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 z-[200] px-6 py-3 rounded-2xl shadow-2xl font-bold text-white transition-all transform translate-y-20 animate-fade-in-up ${type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
  toast.innerHTML = message;
  document.body.appendChild(toast);

  // Animation in
  setTimeout(() => toast.classList.remove('translate-y-20'), 100);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
};

// --- SIDEBAR HELPERS ---
window.toggleSidebar = () => {
  store.uiState.isSidebarCollapsed = !store.uiState.isSidebarCollapsed;
  renderAuthenticatedLayout();
};

window.toggleMobileMenu = () => {
  store.uiState.isMobileMenuOpen = !store.uiState.isMobileMenuOpen;
  renderAuthenticatedLayout();
};


// --- APP ENTRY POINT ---
async function render() {
  // 1. Check for URL view parameter (for QR access)
  const urlParams = new URLSearchParams(window.location.search);
  const requestedView = urlParams.get('view');

  // Try to restore session on first load if not already checked
  if (!store.user && !store.sessionChecked) {
    await store.checkSession();
    store.sessionChecked = true;
  }

  // Routing Logic
  if (requestedView === 'kiosk') {
    renderKioskMode();
  } else if (!store.user) {
    renderPortal();
  } else if (store.user.role === 'kiosco') {
    renderKioskMode();
  } else {
    renderAuthenticatedLayout();
  }
}

// FULL SCREEN KIOSK MODE (Prevents exiting easily)
function renderKioskMode() {
  // Inject Kiosk styles if needed or simply call renderKiosk in a cleaned container
  // We reuse the 'kiosk' view logic but ensure it's the only thing visible
  app.innerHTML = ''; // Wipe everything

  // Create a container for the kiosk
  const kioskContainer = document.createElement('div');
  kioskContainer.id = 'kiosk-root';
  kioskContainer.className = 'w-full h-screen bg-gray-900 overflow-hidden relative';
  app.appendChild(kioskContainer);

  renderKiosk(kioskContainer);

  // Kiosk Logout Hatch (Bottom Left Hidden)
  const logoutBtn = document.createElement('div');
  logoutBtn.className = "fixed bottom-0 left-0 w-20 h-20 z-50 opacity-0 hover:opacity-10 cursor-pointer";
  logoutBtn.ondblclick = async () => {
    if (!store.user) {
      if (confirm("¿Salir del menú?")) {
        store.customerName = '';
        renderPortal();
      }
      return;
    }

    if (confirm("¿Cerrar sesión de Kiosco?")) {
      const pass = prompt("Contraseña Admin Kiosco:");
      if (pass === '1234') { // Should be Env Var or better mechanism
        await store.logout();
        render();
      }
    }
  };
  app.appendChild(logoutBtn);
}

// --- VIEW COMPONENTS ---

// PORTAL PAGE (Landing)
function renderPortal() {
  app.innerHTML = `
    <div class="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-between p-6 font-sans relative overflow-hidden select-none">
      <!-- High-Energy Background Design -->
      <div class="absolute top-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-secondary/20 rounded-full blur-[120px] animate-pulse"></div>
      <div class="absolute bottom-[-10%] left-[-10%] w-[35rem] h-[35rem] bg-primary/10 rounded-full blur-[150px] animate-pulse" style="animation-delay: 2s"></div>
      <div class="absolute inset-0 bg-[radial-gradient(#00000005_1px,transparent_1px)] [background-size:24px_24px]"></div>

      <!-- Floating Pop-Art Food Icons -->
      <div class="absolute top-[15%] left-[10%] text-6xl md:text-8xl opacity-10 animate-float pointer-events-none rotate-12" style="animation-delay: 1s">🍔</div>
      <div class="absolute top-[40%] right-[5%] text-7xl md:text-9xl opacity-10 animate-float pointer-events-none -rotate-12" style="animation-delay: 3.5s">🍟</div>
      <div class="absolute bottom-[20%] left-[5%] text-5xl md:text-7xl opacity-10 animate-float pointer-events-none rotate-45" style="animation-delay: 2s">🥤</div>
      <div class="absolute bottom-[25%] right-[12%] text-6xl md:text-8xl opacity-10 animate-float pointer-events-none -rotate-[30deg]" style="animation-delay: 4.5s">🍗</div>

      <div class="w-full max-w-md md:max-w-2xl flex flex-col items-center gap-10 md:gap-14 z-10 animate-fade-in py-8 md:py-12">
        <!-- Logo Section - Power Brand -->
        <div class="relative group">
            <div class="absolute inset-0 bg-primary/20 blur-[80px] rounded-full scale-150 group-hover:bg-primary/30 transition-all duration-1000"></div>
            <div class="w-64 h-64 md:w-80 md:h-80 mx-auto relative transition-transform duration-700 hover:scale-[1.08] drop-shadow-[0_25px_50px_rgba(255,69,0,0.25)]">
               <img src="/logo.png" class="w-full h-full object-contain" onerror="this.src='https://placehold.co/400x400?text=HEHA'">
            </div>
        </div>

        <!-- Main Interaction Card - "The Hero Card" -->
        <div class="w-full">
            <button id="btn-portal-kiosk" class="group relative w-full bg-white p-10 md:p-14 rounded-[3.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] hover:shadow-[0_60px_120px_-20px_rgba(255,69,0,0.2)] transition-all duration-500 hover:scale-[1.02] active:scale-95 text-center border-4 border-transparent hover:border-primary/10 overflow-hidden">
                <!-- Red & Yellow Accents Inner -->
                <div class="absolute -top-12 -right-12 w-48 h-48 bg-secondary/10 rounded-full blur-3xl group-hover:bg-secondary/20 transition-all"></div>
                <div class="absolute -bottom-12 -left-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
                
                <div class="relative z-10 flex flex-col items-center">
                   <div class="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-primary to-orange-600 rounded-[2.5rem] flex items-center justify-center text-4xl md:text-5xl shadow-[0_20px_40px_rgba(255,69,0,0.4)] mb-8 transform group-hover:rotate-6 transition-transform">
                     🛒
                   </div>
                   
                   <h2 class="text-5xl md:text-7xl font-[1000] text-gray-900 tracking-tighter uppercase leading-none mb-4 italic">
                      MENÚ <span class="text-primary block md:inline font-black">DIGITAL</span>
                   </h2>
                   
                   <p class="text-gray-500 text-lg md:text-2xl font-bold max-w-sm leading-tight mb-10 opacity-80">
                      El sabor que te mueve, <br class="hidden md:block"> directo a tu alcance.
                   </p>
                   
                   <div class="bg-primary text-white px-12 py-6 rounded-full font-black text-xl md:text-2xl uppercase tracking-tighter transition-all shadow-[0_20px_50px_rgba(255,69,0,0.3)] group-hover:shadow-[0_25px_60px_rgba(255,69,0,0.5)] group-hover:bg-orange-600 active:scale-90 flex items-center gap-3">
                      <span>¡Pedir Ahora!</span>
                      <span class="text-2xl">➔</span>
                   </div>
                </div>
            </button>
        </div>

        <!-- Visual Flow Guide -->
        <div class="w-full max-w-sm bg-orange-50/50 backdrop-blur-sm border border-orange-100 rounded-[2.5rem] p-6 md:p-8">
           <div class="flex items-center justify-around gap-4">
              <div class="flex flex-col items-center text-center group">
                 <div class="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl flex items-center justify-center text-2xl md:text-3xl shadow-sm mb-2 group-hover:scale-110 transition-transform">🍔</div>
                 <p class="text-[10px] md:text-xs font-black text-gray-800 uppercase tracking-tighter leading-none">1. PIDE AQUÍ</p>
              </div>
              <div class="text-orange-200 text-2xl md:text-3xl animate-pulse">➔</div>
              <div class="flex flex-col items-center text-center group">
                 <div class="w-12 h-12 md:w-16 md:h-16 bg-secondary text-white rounded-2xl flex items-center justify-center text-2xl md:text-3xl shadow-md mb-2 group-hover:scale-110 transition-transform">💰</div>
                 <p class="text-[10px] md:text-xs font-black text-gray-900 uppercase tracking-tighter leading-none">2. PAGA EN CAJA</p>
              </div>
           </div>
        </div>

        <!-- Staff Access - Minimalist -->
        <button id="btn-portal-login" class="group relative py-2 md:py-4 px-10 rounded-full text-gray-400 hover:text-primary transition-all font-black text-xs md:text-base uppercase tracking-[0.4em]">
           <span class="flex items-center gap-3">
             <span class="text-lg">🔐</span>
             Acceso Staff
           </span>
           <div class="absolute bottom-2 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-primary group-hover:w-full transition-all duration-500"></div>
        </button>
      </div>

      <!-- Footer - Premium Branding -->
      <div class="relative w-full text-center py-6 text-gray-400 font-bold text-[10px] md:text-[12px] uppercase tracking-[0.3em] z-10">
         <div class="flex items-center justify-center gap-4 mb-2">
           <div class="h-[1px] w-12 bg-gray-200"></div>
           <span>HEHA GASTRONOMÍA</span>
           <div class="h-[1px] w-12 bg-gray-200"></div>
         </div>
         <div class="opacity-50 tracking-[0.5em]">TECNOLOGÍA • CALIDAD • EXPERIENCIA</div>
      </div>
    </div>

    <!-- Name Modal Redesign -->
    <div id="portal-name-modal" class="fixed inset-0 bg-black/60 backdrop-blur-xl z-[200] hidden flex items-center justify-center p-4 overflow-y-auto">
       <div class="bg-white w-full max-w-lg rounded-[3.5rem] p-10 md:p-14 shadow-[0_50px_100px_rgba(0,0,0,0.5)] animate-bounce-in-up relative overflow-hidden">
          <!-- Decor inside modal -->
          <div class="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
          
          <div class="text-center mb-10 relative z-10">
             <div class="inline-block bg-secondary/20 p-6 rounded-full mb-6 text-5xl transform -rotate-12 animate-pulse">👋</div>
             <h3 class="text-4xl md:text-5xl font-[1000] text-gray-900 tracking-tighter leading-none">¡HOLA!</h3>
             <p class="text-gray-400 font-black uppercase text-xs tracking-widest mt-4">¿Cuál es tu nombre para el pedido?</p>
          </div>
          
          <input type="text" id="portal-name-input" 
                 placeholder="Escribe tu nombre aquí..." 
                 class="w-full p-6 md:p-8 rounded-3xl bg-gray-50 border-4 border-transparent focus:border-primary outline-none text-2xl md:text-4xl font-black text-center transition-all mb-10 text-gray-800 placeholder:text-gray-300">
          
          <div class="flex flex-col gap-4 relative z-10">
             <button id="btn-portal-confirm" class="w-full bg-primary hover:bg-orange-600 text-white font-black py-6 md:py-8 rounded-3xl shadow-[0_20px_40px_rgba(255,69,0,0.3)] transition active:scale-95 text-xl md:text-2xl uppercase tracking-tighter">
                Comenzar a Comer ➔
             </button>
             <button id="btn-portal-cancel" class="w-full bg-transparent text-gray-400 font-bold py-4 rounded-2xl text-sm uppercase tracking-widest hover:text-gray-600 transition-colors">
                Regresar
             </button>
          </div>
       </div>
    </div>
  `;

  document.getElementById('btn-portal-login').addEventListener('click', renderLogin);

  document.getElementById('btn-portal-kiosk').addEventListener('click', () => {
    document.getElementById('portal-name-modal').classList.remove('hidden');
    document.getElementById('portal-name-input').focus();
  });

  const confirmName = () => {
    const name = document.getElementById('portal-name-input').value.trim();
    if (name) {
      store.customerName = name;
      renderKioskMode();
    } else {
      showToast('Por favor, ingresa tu nombre', 'error');
    }
  };

  document.getElementById('btn-portal-confirm').addEventListener('click', confirmName);
  document.getElementById('btn-portal-cancel').addEventListener('click', () => {
    document.getElementById('portal-name-modal').classList.add('hidden');
  });

  document.getElementById('portal-name-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') confirmName();
  });
}
window.renderPortal = renderPortal;

// CLEAN LOGIN UI
function renderLogin() {
  app.innerHTML = `
    <div class="min-h-screen flex flex-col items-center justify-center bg-[#f3f4f6]">
      <div class="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md animate-fade-in border border-gray-100">
        <div class="relative text-center mb-8">
            <button id="btn-login-back" class="absolute -top-4 -left-4 p-3 text-gray-400 hover:text-gray-900 transition flex items-center gap-2 font-black text-[10px] uppercase tracking-widest bg-gray-50 rounded-xl">
                ⬅️ Volver
            </button>
            <div class="mb-6">
                <img src="/logo.png" class="w-32 h-32 mx-auto object-contain" onerror="this.src='https://placehold.co/150x150?text=HEHA'">
            </div>
            <h1 class="text-4xl font-black text-gray-800 tracking-tight">Acceso Staff</h1>
            <p class="text-gray-400 font-medium mt-2">Ingresa tus credenciales</p>
        </div>
        
        <form id="login-form" class="space-y-6">
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2 ml-1">Correo Electrónico</label>
            <input type="email" id="email" class="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition font-medium text-gray-700 placeholder-gray-400" placeholder="ej. admin@restaurante.com" required>
          </div>
          
          <div>
            <label class="block text-sm font-bold text-gray-700 mb-2 ml-1">Contraseña</label>
            <input type="password" id="password" class="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition font-medium text-gray-700 placeholder-gray-400" placeholder="••••••••" required>
          </div>

          <div id="login-error" class="hidden bg-red-50 text-red-500 text-sm font-bold p-4 rounded-xl text-center border border-red-100 animate-pulse">
            Error de credenciales
          </div>

          <button type="submit" id="btn-login" class="w-full bg-black hover:bg-gray-800 text-white font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95 text-lg flex justify-center items-center gap-2">
            <span>Iniciar Sesión</span>
          </button>
        </form>
        
        <p class="mt-8 text-xs text-center text-gray-400 font-medium">
             Gestión Interna Privada
        </p>
      </div>
      <p class="mt-8 text-gray-400 text-sm font-bold">© 2024 El Sabor POS</p>
    </div>
  `;

  document.getElementById('btn-login-back').addEventListener('click', renderPortal);

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const btn = document.getElementById('btn-login');
    const errDiv = document.getElementById('login-error');

    // Loading State
    btn.disabled = true;
    btn.classList.add('opacity-75', 'cursor-not-allowed');
    btn.innerHTML = '<span class="animate-spin text-2xl">↻</span> Verificando...';
    errDiv.classList.add('hidden');

    try {
      const { error } = await store.login(email, password);
      if (error) throw error;

      // Auto-refresh handled by render() via store logic
      render();
    } catch (err) {
      console.error(err);
      errDiv.innerText = 'Credenciales incorrectas o error de conexión.';
      errDiv.classList.remove('hidden');
      btn.disabled = false;
      btn.classList.remove('opacity-75', 'cursor-not-allowed');
      btn.innerHTML = '<span>Iniciar Sesión</span>';
    }
  });
}

function renderOpenRegisterModal() {
  app.innerHTML = renderCashModal();
  document.getElementById('open-register-btn').addEventListener('click', async () => {
    const amount = document.getElementById('initial-cash-input').value;
    await openRegister(amount);
    store.needsOpenRegister = false;
    render();
  });
}

async function renderAuthenticatedLayout() {
  // Start Realtime for staff
  setupKioskRealtime();

  const isCollapsed = store.uiState.isSidebarCollapsed;
  const isMobileOpen = store.uiState.isMobileMenuOpen;

  // SPECIAL MODE: KIOSK (Full Screen, No Sidebar)
  if (currentView === 'kiosk') {
    app.innerHTML = '';
    const kioskContainer = document.createElement('div');
    kioskContainer.id = 'kiosk-root';
    kioskContainer.className = 'w-full h-screen bg-gray-900 overflow-hidden relative';
    app.appendChild(kioskContainer);
    renderKiosk(kioskContainer);
    return;
  }

  app.innerHTML = `
      <div class="flex h-screen bg-gray-100 overflow-hidden font-sans">
        <!-- Sidebar Overlay (Mobile) -->
        <div class="fixed inset-0 bg-black/50 z-[90] md:hidden transition-opacity duration-300 ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}" onclick="toggleMobileMenu()"></div>

        <!-- Sidebar -->
        <aside class="sidebar-transition sidebar-mobile bg-black text-white flex flex-col z-[100] ${isMobileOpen ? 'open' : ''} ${isCollapsed ? 'md:w-20' : 'md:w-64'} md:relative shadow-2xl">
          <!-- Sidebar Header -->
          <div class="p-4 flex items-center justify-between border-b border-white/10">
              <div class="flex items-center gap-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'md:opacity-0' : 'opacity-100'}">
                <img src="/logo.png" class="w-12 h-12 object-contain" onerror="this.src='https://placehold.co/48x48?text=H'">
                <h1 class="font-black text-xl tracking-tighter whitespace-nowrap">HEHA <span class="text-primary font-medium italic">POS</span></h1>
              </div>
              <button onclick="toggleSidebar()" class="hidden md:flex p-2 hover:bg-white/10 rounded-xl transition-colors">
                ${isCollapsed ? '➡️' : '⬅️'}
              </button>
              <button onclick="toggleMobileMenu()" class="md:hidden p-2 text-white">✕</button>
          </div>

          <!-- User Profile Brief -->
          <div class="p-6 transition-all duration-300 ${isCollapsed ? 'md:px-2 text-center' : ''}">
              <div class="flex items-center gap-3 mb-2 overflow-hidden">
                <div class="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold flex-shrink-0">
                  ${store.user.full_name?.[0] || 'U'}
                </div>
                <div class="transition-opacity duration-300 ${isCollapsed ? 'md:hidden' : 'opacity-100'}">
                   <p class="font-black text-sm truncate">${store.user.full_name || 'Usuario'}</p>
                   <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">${store.user.role === 'admin' ? 'Administrador' : 'Cajero'}</p>
                </div>
              </div>
              ${store.currentSession && !isCollapsed ? '<span class="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full animate-pulse">● Caja Abierta</span>' : ''}
              ${store.currentSession && isCollapsed ? '<span class="block w-2 h-2 mx-auto bg-green-400 rounded-full animate-pulse mt-2"></span>' : ''}
          </div>

          <nav class="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-hide">
             ${renderNavLink('dashboard', '🏠', 'Inicio', isCollapsed)}
             ${renderNavLink('pos', '🛒', 'Punto de Venta', isCollapsed)}
             ${renderNavLink('orders', '📋', 'Pedidos del Día', isCollapsed)}
             ${renderNavLink('kiosk-orders', '🤖', 'Aprobar Kiosco', isCollapsed, true)}
             
             ${store.user.role === 'admin' ? `
               <div class="pt-4 pb-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-4 transition-opacity duration-300 ${isCollapsed ? 'md:hidden' : 'opacity-100'}">Admin</div>
               ${renderNavLink('products', '🍔', 'Productos', isCollapsed)}
               ${renderNavLink('reports', '📊', 'Reportes', isCollapsed)}
               ${renderNavLink('users', '👥', 'Usuarios', isCollapsed)}
               ${renderNavLink('kiosk', '🖥️', 'Modo Kiosco', isCollapsed)}
             ` : ''}

             <div class="pt-4 border-t border-white/5 mt-4">
                ${renderNavLink('cash', '💰', 'Gestión Caja', isCollapsed)}
             </div>
          </nav>

          <div class="p-4 border-t border-white/10">
            <button onclick="handleLogout()" class="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all group ${isCollapsed ? 'md:justify-center' : ''}">
               <span class="text-xl group-hover:scale-110 transition">🚪</span>
               <span class="font-black text-sm uppercase tracking-tighter truncate transition-opacity duration-300 ${isCollapsed ? 'md:hidden' : 'opacity-100'}">Cerrar Sesión</span>
            </button>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 h-screen overflow-hidden flex flex-col relative" id="main-area">
           <!-- Global Header (Responsive Toggle) -->
           <header class="bg-white p-4 h-20 flex items-center justify-between shadow-sm z-50 flex-shrink-0">
              <div class="flex items-center gap-4">
                 <button onclick="toggleMobileMenu()" class="md:hidden p-3 bg-gray-50 rounded-2xl text-xl">☰</button>
                 <div class="md:hidden">
                   <h1 class="font-black text-lg tracking-tighter">HEHA <span class="text-primary">POS</span></h1>
                 </div>
                 <div class="hidden md:block">
                   <h2 class="text-xs font-black text-gray-400 uppercase tracking-[0.3em]" id="view-title-tag">Panel Principal</h2>
                 </div>
              </div>
              
              <div class="flex items-center gap-4">
                 <div class="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
                    <span class="text-lg">⏰</span>
                    <span class="font-black text-sm text-gray-600 tabular-nums" id="live-clock">00:00:00</span>
                 </div>
              </div>
           </header>
           
           <div id="page-content" class="flex-1 overflow-auto p-4 md:p-10 bg-[#f8f9fc] relative scrollbar-hide">
              <!-- Content Injected Here -->
           </div>

           <!-- Floating Toast Container can go here or body -->
        </main>
      </div>
    `;

  // Start live clock
  if (!window._clockTimer) {
    window._clockTimer = setInterval(() => {
      const el = document.getElementById('live-clock');
      if (el) el.innerText = new Date().toLocaleTimeString('es-ES');
    }, 1000);
  }

  // Inject View Content
  const pageContent = document.getElementById('page-content');
  const tag = document.getElementById('view-title-tag');
  if (tag) tag.innerText = getViewTitle(currentView);

  if (currentView === 'dashboard') {
    renderDashboard(pageContent);
  } else if (currentView === 'pos') {
    renderPOSView(pageContent);
  } else if (currentView === 'reports') {
    pageContent.innerHTML = '<div class="flex justify-center p-10"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div></div>';
    renderReports().then(html => {
      pageContent.innerHTML = html;
    });
  } else if (currentView === 'products') {
    renderProductManager(pageContent);
  } else if (currentView === 'users') {
    renderUsersManager(pageContent);
  } else if (currentView === 'orders') {
    renderOrdersHistory(pageContent);
  } else if (currentView === 'kiosk-orders') {
    renderKioskManagerView(pageContent);
  } else if (currentView === 'cash') {
    // ---- CASHIER VIEW LOGIC ----

    let cashInfoHTML = '';

    if (store.currentSession) {
      // Fetch calculations for live view
      const report = await getDailyReport();
      const cashSales = report ? report.paymentBreakdown.cash : 0;
      const initial = store.currentSession.initial_cash;
      const totalInDrawer = initial + cashSales;

      cashInfoHTML = `
           <div class="bg-blue-50 p-6 rounded-lg border border-blue-200 mb-6 text-center">
             <p class="text-sm text-blue-600 font-bold uppercase mb-1">Monto Total en Caja</p>
             <p class="text-xs text-gray-500 mb-2">(Inicial + Ventas Efectivo)</p>
             <p class="text-4xl font-bold text-blue-900">Bs. ${totalInDrawer.toFixed(2)}</p>
           </div>
           
           <div class="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-6">
              <div class="bg-white p-3 rounded border text-center">
                 <p>Fondo Inicial</p>
                 <p class="font-bold">Bs. ${initial.toFixed(2)}</p>
              </div>
              <div class="bg-white p-3 rounded border text-center">
                 <p>Ventas Efectivo</p>
                 <p class="font-bold text-green-600">+ Bs. ${cashSales.toFixed(2)}</p>
              </div>
           </div>
        `;
    }

    pageContent.innerHTML = `
         <div class="bg-white p-6 rounded-xl shadow-lg max-w-lg mx-auto mt-10">
           <div class="flex justify-between items-center mb-6">
               <h2 class="text-2xl font-bold text-gray-800">Mi Caja</h2>
               <span class="px-3 py-1 rounded-full text-xs font-bold ${store.currentSession ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                 ${store.currentSession ? 'TURNO ABIERTO' : 'CERRADO'}
               </span>
           </div>
           
           ${store.currentSession ? `
             ${cashInfoHTML}
             
             <div class="mt-6 p-4 bg-yellow-50 rounded border border-yellow-200">
               <p class="text-sm text-yellow-800 font-bold">¿Finalizar Turno?</p>
               <p class="text-xs text-yellow-600 mb-3">Se realizará el arqueo y cierre.</p>
                <button class="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl transition shadow-lg shadow-red-500/20 active:scale-95" onclick="handleCloseRegister()">
                  CERRAR CAJA
                </button>
              </div>
           ` : `
             <div class="text-center py-8">
               <p class="text-gray-500 mb-4">No tienes una sesión activa.</p>
               <p class="text-sm text-gray-400">Pide a un administrador que reinicie el sistema si necesitas abrir caja nuevamente o usa el botón de inicio.</p>
             </div>
           `}
         </div>
       `;
    loadOrders();
    renderOrdersList();
  }
}

// --- NAVIGATION HELPERS ---
function renderNavLink(view, icon, label, isCollapsed, showBadge = false) {
  const active = currentView === view;
  const activeClass = 'bg-primary text-white font-black shadow-lg shadow-primary/20 scale-[1.02]';
  const inactiveClass = 'text-gray-400 hover:bg-white/10 hover:text-white';

  return `
    <button onclick="setView('${view}')" 
            class="w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-300 group ${active ? activeClass : inactiveClass} ${isCollapsed ? 'md:justify-center px-0' : ''}">
      <span class="text-xl group-hover:scale-110 transition shrink-0">${icon}</span>
      <span class="font-black text-sm uppercase tracking-tighter truncate transition-opacity duration-300 ${isCollapsed ? 'md:hidden' : 'opacity-100'}">${label}</span>
      ${showBadge ? `<span id="kiosk-order-badge" class="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full hidden animate-bounce ${isCollapsed ? 'md:absolute md:top-2 md:right-2' : ''}">0</span>` : ''}
    </button>
  `;
}

function getViewTitle(view) {
  const titles = {
    'dashboard': 'Panel de Resumen',
    'pos': 'Terminal de Ventas',
    'orders': 'Historial de Pedidos',
    'kiosk-orders': 'Aprobación Kiosco',
    'products': 'Gestión de Productos',
    'reports': 'Reportes y Estadísticas',
    'users': 'Gestión de Usuarios',
    'cash': 'Gestión de Caja'
  };
  return titles[view] || 'Dashboard';
}

// POS State
let allProducts = [];
let activePosCategory = 'Todos';
let posSearchQuery = '';

function renderPOSView(container) {
  container.innerHTML = `
    <div class="grid grid-cols-12 gap-6 h-full animate-fade-in">
       <div class="col-span-12 lg:col-span-8 flex flex-col h-full" id="products-area">
          <!-- POS Header & Search -->
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 flex-shrink-0">
              <div>
                <h2 class="text-3xl font-black text-gray-800 tracking-tight">Menú</h2>
                <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">Selecciona productos para la orden</p>
              </div>
              <div class="relative w-full md:w-64">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
                <input type="text" id="pos-search" 
                       placeholder="Buscar producto..." 
                       oninput="searchProducts(this.value)"
                       class="w-full pl-12 pr-4 py-3 rounded-2xl bg-white border border-gray-200 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium">
              </div>
          </div>
          
          <!-- Categories Bar -->
          <div class="mb-6 flex gap-3 overflow-x-auto pb-4 scrollbar-hide flex-shrink-0" id="pos-categories">
              <!-- Filled by JS -->
          </div>

          <!-- Products Grid -->
          <div id="products-grid" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pr-2 pb-10 flex-1 content-start scrollbar-hide">
            <div class="col-span-full py-20 flex flex-col items-center justify-center text-gray-300">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p class="font-bold">Cargando catálogo...</p>
            </div>
          </div>
       </div>

       <!-- Sidebar Area -->
       <div class="col-span-12 lg:col-span-4 bg-white rounded-[2.5rem] shadow-xl flex flex-col h-full border border-gray-100 overflow-hidden relative" id="pos-sidebar">
          ${renderCartUI()}
       </div>
    </div>
  `;

  loadProducts();
  renderCartList();
}

window.searchProducts = (query) => {
  posSearchQuery = query.toLowerCase();
  renderProductGrid();
};

// Global helper for filtering
window.setPosCategory = (cat) => {
  activePosCategory = cat;
  renderProductGrid();
  renderCategories(); // To update active state
};

async function loadProducts() {
  const { data } = await supabase.from('products').select('*').order('name');
  if (data) {
    allProducts = data;
    renderCategories();
    renderProductGrid();
  }
}

function renderCategories() {
  const container = document.getElementById('pos-categories');
  if (!container) return;

  const categories = ['Todos', ...new Set(allProducts.map(p => p.category || 'General'))];

  container.innerHTML = categories.map(cat => `
      <button onclick="setPosCategory('${cat}')" 
          class="px-5 py-2.5 rounded-2xl text-sm font-black whitespace-nowrap transition-all shadow-sm border ${activePosCategory === cat ? 'bg-black text-white border-black scale-105' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}">
          ${cat}
      </button>
  `).join('');
}

function renderProductGrid() {
  const container = document.getElementById('products-grid');
  if (!container) return;

  let filtered = activePosCategory === 'Todos'
    ? allProducts
    : allProducts.filter(p => (p.category || 'General') === activePosCategory);

  if (posSearchQuery) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(posSearchQuery));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-20 flex flex-col items-center justify-center text-gray-300">
        <span class="text-6xl mb-4">🤷‍♂️</span>
        <p class="text-xl font-black">No se encontraron productos</p>
        <p class="font-medium">Prueba con otra búsqueda o categoría.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(p => `
      <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col group animate-fade-in-up" onclick="showQuantityModal(${p.id})">
         <div class="h-40 bg-gray-50 relative overflow-hidden">
           <img src="${p.image_url}" class="w-full h-full object-cover group-hover:scale-110 transition duration-700" onerror="this.src='https://placehold.co/400x300?text=${p.name}'">
           <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
           <div class="absolute bottom-3 right-3 bg-primary text-white px-3 py-1 rounded-full text-sm font-black shadow-lg">
              Bs. ${p.price}
           </div>
         </div>
         <div class="p-4 flex-1 flex flex-col justify-between capitalize">
           <h3 class="font-black text-gray-800 leading-tight group-hover:text-primary transition-colors">${p.name.toLowerCase()}</h3>
           <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-2">${p.category || 'General'}</p>
         </div>
      </div>
  `).join('');
}

// --- LOGIC HELPERS ---
window.setPosPaymentMethod = (method) => {
  store.posPaymentMethod = method;
  const sidebar = document.getElementById('pos-sidebar');
  if (sidebar) sidebar.innerHTML = renderCartUI();
  renderCartList();
};

window.setView = async (view) => {
  if ((view === 'products' || view === 'reports') && store.user.role !== 'admin') {
    return alert('Acceso Denegado: Solo Administradores.');
  }
  currentView = view;
  await renderAuthenticatedLayout(); // Re-render logic needs to handle async for some views now
};

window.setOrderType = (type) => {
  store.orderType = type;
  // Update UI bits
  const badge = document.getElementById('order-type-badge');
  if (badge) badge.innerText = type === 'whatsapp' ? 'WhatsApp' : (type === 'mesa' ? 'Mesa' : 'Para Llevar');

  // Re-render controls classes
  document.querySelectorAll('.order-type-btn').forEach(btn => {
    // rudimentary class toggle based on onclick attr parsing or just re-render cart UI
  });

  // Easiest: Re-render Cart UI section
  const sidebar = document.getElementById('pos-sidebar');
  if (sidebar) sidebar.innerHTML = renderCartUI();
  renderCartList();
};

function renderCartUI() {
  return `
    <!-- Cart Header -->
    <div class="p-6 border-b border-gray-100 bg-gray-50/50">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-black text-xl text-gray-800 tracking-tight">Orden Actual</h3>
          <span class="bg-black text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest" id="order-type-badge">
            ${store.orderType === 'whatsapp' ? 'WhatsApp' : (store.orderType === 'mesa' ? 'Mesa' : 'Llevar')}
          </span>
        </div>
        
        <div class="flex bg-gray-100 rounded-2xl p-1.5" id="order-type-controls">
          <button onclick="setOrderType('mesa')" class="order-type-btn flex-1 py-2 text-xs font-black rounded-xl ${store.orderType === 'mesa' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:bg-gray-200'} transition-all uppercase tracking-tighter">Mesa</button>
          <button onclick="setOrderType('llevar')" class="order-type-btn flex-1 py-2 text-xs font-black rounded-xl ${store.orderType === 'llevar' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:bg-gray-200'} transition-all uppercase tracking-tighter">Llevar</button>
          <button onclick="setOrderType('whatsapp')" class="order-type-btn flex-1 py-2 text-xs font-black rounded-xl ${store.orderType === 'whatsapp' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:bg-gray-200'} transition-all uppercase tracking-tighter">Envío</button>
        </div>

        ${store.orderType !== 'whatsapp' ? `
        <div class="mt-4 space-y-4">
          <div>
            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nombre del Cliente</p>
            <input type="text" id="pos-customer-name" 
                   placeholder="Ej. Juan Pérez" 
                   class="w-full text-sm p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none transition" 
                   value="${store.posCustomerName}" 
                   onchange="updatePosCustomerName(this.value)">
          </div>

          <div>
            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Método de Pago</p>
            <div class="flex bg-gray-100 rounded-2xl p-1.5">
              <button onclick="setPosPaymentMethod('cash')" class="flex-1 py-2 text-xs font-black rounded-xl ${store.posPaymentMethod === 'cash' ? 'bg-green-500 text-white shadow-md' : 'text-gray-400 hover:bg-gray-200'} transition-all uppercase tracking-tighter flex items-center justify-center gap-2">
                💵 EFECTIVO
              </button>
              <button onclick="setPosPaymentMethod('qr')" class="flex-1 py-2 text-xs font-black rounded-xl ${store.posPaymentMethod === 'qr' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-400 hover:bg-gray-200'} transition-all uppercase tracking-tighter flex items-center justify-center gap-2">
                📱 QR / TRANSF.
              </button>
            </div>
          </div>
        </div>
        ` : ''}
    </div>
    
    <!-- Cart Items Area -->
    <div class="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide" id="cart-items">
        <!-- Replaced by JS -->
    </div>
    
    <!-- Cart Footer & Checkout -->
    <div class="p-8 bg-white border-t border-gray-100">
        <div class="space-y-2 mb-6">
          <div class="flex justify-between text-gray-400 font-bold text-sm uppercase tracking-widest">
            <span>Subtotal</span>
            <span id="cart-subtotal">Bs. ${store.cartTotal.toFixed(2)}</span>
          </div>
          <div class="flex justify-between text-3xl font-black text-gray-800">
            <span>Total</span>
            <span id="cart-total" class="text-primary">Bs. ${store.cartTotal.toFixed(2)}</span>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3">
          <button onclick="handleCheckout(true)" class="w-full bg-primary hover:bg-orange-600 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-primary/20 transition transform active:scale-95 flex justify-center items-center gap-2 text-lg">
            ⚡ COBRAR DIRECTO
          </button>
          <button onclick="handleCheckout(false)" class="w-full bg-gray-50 hover:bg-gray-100 text-gray-800 font-black py-4 rounded-[1.5rem] transition transform active:scale-95 flex justify-center items-center gap-2 text-sm border border-gray-200">
            👁️ VISTA PREVIA TICKET
          </button>
        </div>
    </div>
  `;
}

function renderCartList() {
  const container = document.getElementById('cart-items');
  if (!container) return;

  let html = '';

  // WhatsApp Fields
  if (store.orderType === 'whatsapp') {
    html += `
    <div class="bg-blue-50/50 p-4 rounded-3xl mb-6 border border-blue-100 shadow-sm animate-fade-in-up">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-lg">🚚</span>
        <h4 class="text-xs font-black text-blue-800 uppercase tracking-widest">Datos de Envío</h4>
      </div>
      <div class="space-y-3">
        <input type="tel" placeholder="Teléfono del cliente" 
               class="w-full text-sm p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none transition" 
               value="${store.whatsappDetails.phone}" onchange="updateWhatsappPhone(this.value)">
        <input type="text" placeholder="Dirección de entrega" 
               class="w-full text-sm p-3 rounded-xl border border-blue-100 focus:ring-2 focus:ring-blue-400 outline-none transition" 
               value="${store.whatsappDetails.location}" onchange="updateWhatsappLocation(this.value)">
        
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 ml-1">Pago</label>
                <select class="w-full text-sm p-3 rounded-xl border border-blue-100 bg-white" onchange="updateWhatsappPayment(this.value)">
                    <option value="qr" ${store.whatsappDetails.paymentMethod === 'qr' ? 'selected' : ''}>QR</option>
                    <option value="efectivo" ${store.whatsappDetails.paymentMethod === 'efectivo' ? 'selected' : ''}>Efectivo</option>
                    <option value="pendiente" ${store.whatsappDetails.paymentMethod === 'pendiente' ? 'selected' : ''}>A Cobrar</option>
                </select>
            </div>
            <div>
                <label class="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 ml-1">Adelanto</label>
                <input type="number" placeholder="0.00" 
                   class="w-full text-sm p-3 rounded-xl border border-blue-100" 
                   value="${store.whatsappDetails.advance}" onchange="updateWhatsappAdvance(this.value)">
            </div>
        </div>
      </div>
    </div>
  `;
  }

  if (store.cart.length === 0) {
    container.innerHTML = html + `
      <div class="h-full flex flex-col items-center justify-center text-gray-300 py-10 opacity-50">
        <span class="text-6xl mb-4">🛒</span>
        <p class="font-black uppercase tracking-widest text-xs">Carrito Vacío</p>
      </div>
    `;
    return;
  }

  html += store.cart.map(item => `
    <div class="bg-gray-50/50 p-4 rounded-3xl flex flex-col gap-4 group border border-transparent hover:border-gray-100 hover:bg-white transition-all duration-300 animate-fade-in-up">
        <div class="flex justify-between items-start gap-3">
            <div class="flex-1">
                <h4 class="font-black text-gray-800 leading-tight capitalize mb-1">${item.product.name.toLowerCase()}</h4>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Bs. ${item.product.price.toFixed(2)} c/u
                </p>
            </div>
            <p class="font-black text-gray-800 text-lg">
                <span class="text-xs font-medium text-gray-400">Bs.</span> 
                ${(item.product.price * item.quantity).toFixed(2)}
            </p>
        </div>
        
        <div class="flex justify-between items-center">
            <div class="flex items-center bg-white border border-gray-100 rounded-2xl p-1 shadow-sm">
                <button onclick="updateQty(${item.product.id}, -1)" class="w-10 h-10 flex items-center justify-center hover:bg-gray-50 text-gray-400 font-black transition-colors rounded-xl">-</button>
                <span class="w-10 text-center text-sm font-black text-gray-800">${item.quantity}</span>
                <button onclick="updateQty(${item.product.id}, 1)" class="w-10 h-10 flex items-center justify-center hover:bg-gray-800 hover:text-white text-gray-400 font-black transition-all rounded-xl">+</button>
            </div>
            <button onclick="updateQty(${item.product.id}, -999)" class="w-10 h-10 rounded-2xl flex items-center justify-center text-red-100 hover:text-red-500 hover:bg-red-50 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
        </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

// Add to Cart
window.addToCart = (id) => {
  const p = allProducts.find(x => x.id === id);
  if (p) store.addToCart(p);
  renderCartList();
  updateTotals();

  // Feedback sutil
  showToast(`✅ ${p.name.toLowerCase()} añadido`, 'success');
};

// NEW: Quick Quantity Modal
window.showQuantityModal = (productId) => {
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;

  const modal = document.createElement('div');
  modal.id = 'qty-modal';
  modal.className = 'fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in';

  modal.innerHTML = `
    <div class="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 animate-bounce-slow" onclick="event.stopPropagation()">
        <div class="text-center mb-6">
            <h3 class="text-2xl font-black text-gray-800 tracking-tight capitalize mb-1">${p.name.toLowerCase()}</h3>
            <p class="text-xs text-gray-400 font-bold uppercase">Especificar Cantidad</p>
        </div>

        <div class="mb-8">
            <input type="number" id="qty-input" 
                   value="1" min="1" step="1"
                   class="w-full text-center text-6xl font-black p-4 bg-gray-50 rounded-3xl border-2 border-transparent focus:border-primary focus:bg-white outline-none transition-all text-primary"
                   onkeydown="if(event.key === 'Enter') confirmQty(${p.id}); if(event.key === 'Escape') closeModal();">
        </div>

        <div class="grid grid-cols-2 gap-4">
            <button onclick="closeModal()" class="py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-100 transition uppercase tracking-widest text-xs font-bold">Cancelar</button>
            <button onclick="confirmQty(${p.id})" class="py-4 bg-black text-white rounded-2xl font-black shadow-lg shadow-black/20 hover:scale-[1.05] transition active:scale-95 uppercase tracking-widest text-xs font-bold">Agregar</button>
        </div>
    </div>
  `;

  modal.onclick = closeModal;
  document.body.appendChild(modal);

  // Auto focus input
  const input = document.getElementById('qty-input');
  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);
};

window.closeModal = () => {
  const modal = document.getElementById('qty-modal');
  if (modal) modal.remove();
};

window.confirmQty = (productId) => {
  const input = document.getElementById('qty-input');
  const qty = parseInt(input.value);

  if (isNaN(qty) || qty <= 0) {
    showToast('❌ Cantidad no válida', 'error');
    return;
  }

  const p = allProducts.find(x => x.id === productId);
  if (p) {
    // We modify store.js's addToCart if necessary or just call it in a loop
    // But store.addToCart already takes a second optional parameter 'quantity'
    store.addToCart(p, qty);
    renderCartList();
    updateTotals();
    showToast(`🚀 Añadido: <b>${qty}x ${p.name.toLowerCase()}</b>`, 'success');
  }

  closeModal();
};

// WhatsApp Helpers
window.updateWhatsappPhone = (val) => {
  store.whatsappDetails.phone = val;
};
window.updateWhatsappLocation = (val) => {
  store.whatsappDetails.location = val;
};
window.updateWhatsappPayment = (val) => {
  store.whatsappDetails.paymentMethod = val;
};

window.updatePosCustomerName = (val) => {
  store.posCustomerName = val;
};
window.updateWhatsappAdvance = (val) => {
  store.whatsappDetails.advance = parseFloat(val) || 0;
};
window.updateQty = (id, delta) => {
  store.updateCartQuantity(id, delta);
  renderCartList();
  updateTotals();
};

function updateTotals() {
  const elSub = document.getElementById('cart-subtotal');
  const elTot = document.getElementById('cart-total');
  if (elSub) elSub.innerText = `Bs. ${store.cartTotal.toFixed(2)}`;
  if (elTot) elTot.innerText = `Bs. ${store.cartTotal.toFixed(2)}`;
}

window.updatePosCartQty = (id, delta) => {
  store.updateCartQuantity(id, delta);
  renderCartList();
  updateTotals();
};

// Checkout
window.handleCheckout = async (directPrint = false) => {
  if (store.cart.length === 0) return alert('Carrito vacío');
  if (store.orderType === 'whatsapp') {
    const phone = store.whatsappDetails.phone.trim();
    if (!phone) return alert('Ingrese teléfono para Delivery');
    // Validation for Bolivia: Usually 8 digits for mobile, 7 for landline. 
    // User asked for 7, allowing 7 or 8 to be safe and flexible.
    if (!/^\d{7,8}$/.test(phone)) {
      return alert('El número de teléfono debe tener 7 u 8 dígitos numéricos válidos para Bolivia.');
    }
  }

  // Order Object
  const order = {
    id: Date.now().toString().slice(-6),
    total_amount: store.cartTotal,
    order_type: store.orderType,
    customer_name: store.orderType === 'whatsapp' ? store.customerName : store.posCustomerName,
    customer_phone: store.whatsappDetails.phone,
    delivery_location: store.whatsappDetails.location,
    advance_amount: store.orderType === 'whatsapp' ? store.whatsappDetails.advance : 0,
    payment_method: store.orderType === 'whatsapp' ? store.whatsappDetails.paymentMethod : store.posPaymentMethod,
    cashier_name: store.user.role === 'admin' ? 'Admin' : 'Cajero',
    created_at: new Date()
  };

  // 1. Save to DB
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      total_amount: order.total_amount,
      order_type: order.order_type,
      status: 'completed',
      customer_name: order.customer_name,
      payment_method: store.orderType === 'whatsapp' ? store.whatsappDetails.paymentMethod : store.posPaymentMethod,
      advance_amount: order.advance_amount,
      customer_phone: order.customer_phone,
      delivery_location: order.delivery_location,
      created_at: order.created_at
    })
    .select()
    .single();

  if (orderError) {
    console.error('Error saving order:', orderError);
    alert('Error al guardar pedido en base de datos. Se imprimirá ticket de respaldo.');
  } else if (orderData) {
    // Save Items
    const itemsToInsert = store.cart.map(item => ({
      order_id: orderData.id,
      product_id: item.product.id,
      quantity: item.quantity,
      price_at_sale: item.product.price // Correct column name!
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsError) {
      console.error('Error saving items:', itemsError);
      alert('Error CRÍTICO al guardar items: ' + itemsError.message);
    }
    if (itemsError) console.error('Error saving items:', itemsError);
  }

  // 2. Handle Printing / Preview
  const ticketHTML = generateReceiptHTML(order, store.cart);

  if (directPrint) {
    import('./utils/printer.js').then(m => m.printTicket(ticketHTML));
    showToast('⚡ ¡Imprimiendo Ticket y Guardado!');
  } else {
    showTicketPreview(ticketHTML, order, [...store.cart]);
  }

  // 3. WhatsApp (Always copy if needed)
  if (store.orderType === 'whatsapp') {
    const msg = generateWhatsAppMessage(order, store.cart);
    try {
      await navigator.clipboard.writeText(msg);
      if (directPrint) showToast('📋 Datos copiados para WhatsApp');
    } catch (err) {
      console.warn("Could not copy whatsapp message", err);
    }
  }

  // Clear cart and reset
  store.clearCart();
  store.posCustomerName = '';
  store.whatsappDetails = { phone: '', location: '', paymentMethod: 'cash', advance: 0 };
  renderPOSView(document.getElementById('page-content'));
};

function showTicketPreview(html, order, cartItems) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4 animate-fade-in';
  modal.innerHTML = `
      < div class="bg-white rounded-3xl overflow-hidden max-w-sm w-full shadow-2xl flex flex-col max-h-[90vh]" >
      <div class="p-4 bg-gray-50 border-b flex justify-between items-center">
        <h3 class="font-black text-gray-800">Vista Previa del Ticket</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      
      <div class="flex-1 overflow-y-auto p-8 flex justify-center bg-gray-100">
        <div class="bg-white shadow-md p-4 transform scale-90 origin-top">
          ${html}
        </div>
      </div>
      
      <div class="p-6 bg-white border-t space-y-3">
        <button id="modal-print-btn" class="w-full bg-primary hover:bg-orange-600 text-white font-black py-4 rounded-xl shadow-lg transition flex justify-center items-center gap-2">
          🖨️ IMPRIMIR TICKET
        </button>
        <button onclick="this.closest('.fixed').remove()" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition">
          FINALIZAR SIN IMPRIMIR
        </button>
      </div>
    </div >
      `;

  document.body.appendChild(modal);

  document.getElementById('modal-print-btn').onclick = () => {
    import('./utils/printer.js').then(m => m.printTicket(html));
  };
}

// Close Register
window.handleCloseRegister = async () => {
  if (!confirm('¿Seguro que desea cerrar caja? Esto finalizará el turno actual.')) return;

  // 1. Get Report Data
  const report = await getDailyReport();
  if (!report) return alert('No se pudo generar el reporte para el cierre.');

  // 2. Get initial cash from store
  const initialCash = store.initialCash || 0;

  // 3. Create and show modal for cash reconciliation
  const modalHTML = `
      < div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" >
        <div class="bg-white p-6 rounded-lg shadow-xl w-96">
          <h3 class="text-xl font-bold mb-4 text-gray-800">Cierre de Caja</h3>
          <p class="text-gray-700 mb-2">Efectivo Inicial: <span class="font-semibold">Bs. ${initialCash.toFixed(2)}</span></p>
          <p class="text-gray-700 mb-2">Ventas en Efectivo: <span class="font-semibold">Bs. ${report.paymentBreakdown.cash.toFixed(2)}</span></p>
          <p class="text-gray-700 mb-4">Retiros: <span class="font-semibold">Bs. ${report.totalWithdrawals.toFixed(2)}</span></p>

          <label for="actual-cash-input" class="block text-sm font-medium text-gray-700 mb-1">Monto contado en caja (Bs.):</label>
          <input type="number" id="actual-cash-input" class="w-full p-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary mb-4" placeholder="0.00">

            <div id="diff-preview" class="hidden text-center mb-4">
              <p class="text-sm text-gray-600">Diferencia:</p>
              <span id="diff-amount" class="text-xl font-bold text-gray-800"></span>
            </div>

            <div class="flex justify-end space-x-3">
              <button id="cancel-close-btn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition">Cancelar</button>
              <button id="confirm-close-btn" class="px-4 py-2 bg-primary text-white rounded-md hover:bg-orange-600 transition">Confirmar Cierre</button>
            </div>
        </div>
  </div >
      `;

  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer);

  // 4. Modal Logic
  const input = document.getElementById('actual-cash-input');
  const diffDisplay = document.getElementById('diff-preview');
  const diffAmount = document.getElementById('diff-amount');

  // CORRECTION: Expected now includes withdrawals subtraction
  const withdrawals = report.totalWithdrawals || 0;
  const expected = initialCash + report.paymentBreakdown.cash - withdrawals;

  // Live Difference Calculation
  input.addEventListener('input', (e) => {
    const actual = parseFloat(e.target.value) || 0;
    const diff = actual - expected;

    diffDisplay.classList.remove('hidden');
    diffAmount.innerText = `Bs.${diff.toFixed(2)} `;

    if (diff < 0) {
      diffAmount.className = 'text-xl font-bold text-red-600';
      diffAmount.innerText += ' (Faltante)';
    } else if (diff > 0) {
      diffAmount.className = 'text-xl font-bold text-green-600';
      diffAmount.innerText += ' (Sobrante)';
    } else {
      diffAmount.className = 'text-xl font-bold text-gray-800';
      diffAmount.innerText += ' (Exacto)';
    }
  });

  // Cancel
  document.getElementById('cancel-close-btn').addEventListener('click', () => {
    document.body.removeChild(modalContainer);
  });

  // Confirm Close
  document.getElementById('confirm-close-btn').addEventListener('click', async () => {
    const actualCash = parseFloat(input.value);
    if (isNaN(actualCash)) return alert('Por favor ingresa el monto contado.');

    if (!confirm('¿Confirmar cierre de caja? Esta acción es irreversible.')) return;

    // Prepare Reconciled Data
    const closeDetails = {
      finalCash: actualCash,
      expectedCash: expected,
      difference: actualCash - expected,
      salesCash: report.paymentBreakdown.cash,
      salesDigital: report.paymentBreakdown.digital
    };

    // DB Close
    await closeRegister(closeDetails);

    // Remove Modal
    document.body.removeChild(modalContainer);

    // Generate & Print Full Report
    const fullReport = {
      ...report,
      reconciliation: closeDetails,
      initialCash: initialCash
    };

    // Pass ROLE to hide details if not admin
    const reportHTML = generateCloseReportHTML(fullReport, store.user.role === 'admin' ? 'Admin' : 'Cajero', store.user.role);
    printTicket(reportHTML);

    alert('Turno cerrado exitosamente.');
    location.reload();
  });
};



// --- USER MANAGEMENT (ADMIN) ---

async function renderUsersManager(container) {
  container.innerHTML = `
      <div class="flex flex-col h-full animate-fade-in">
      <div class="flex justify-between items-center mb-6">
          <h2 class="text-3xl font-black text-gray-800">Gestión de Personal</h2>
          <button id="btn-new-user" class="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transform transition active:scale-95">
              <span>+ Nuevo Usuario</span>
          </button>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
          <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                  <thead>
                      <tr class="bg-gray-50 border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wider">
                          <th class="p-4 font-bold">Nombre</th>
                          <th class="p-4 font-bold">Email</th>
                          <th class="p-4 font-bold">Rol</th>
                          <th class="p-4 font-bold text-right">Acciones</th>
                      </tr>
                  </thead>
                  <tbody id="users-table-body" class="text-gray-600 text-sm">
                      <tr><td colspan="4" class="p-8 text-center">Cargando usuarios...</td></tr>
                  </tbody>
              </table>
          </div>
      </div>
  </div>

  <!--NEW USER MODAL-->
      <div id="user-modal" class="fixed inset-0 bg-black/50 hidden flex items-center justify-center z-50 backdrop-blur-sm">
        <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-all scale-95 opacity-0" id="user-modal-content">
          <h3 class="text-2xl font-bold mb-1 text-gray-800">Nuevo Usuario</h3>
          <p class="text-gray-400 text-sm mb-6">Crea una cuenta para tu equipo.</p>

          <form id="new-user-form" class="space-y-4">
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1 ml-1">Nombre Completo</label>
              <input type="text" id="new-user-name" class="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black outline-none font-medium" placeholder="ej. Juan Pérez" required>
            </div>
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1 ml-1">Correo (Login)</label>
              <input type="email" id="new-user-email" class="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black outline-none font-medium" placeholder="ej. cajero1@local.com" required>
            </div>
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1 ml-1">Contraseña</label>
              <input type="password" id="new-user-pass" class="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-black outline-none font-medium" placeholder="Mínimo 6 caracteres" required minlength="6">
            </div>
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1 ml-1">Rol</label>
              <div class="grid grid-cols-3 gap-2">
                <label class="cursor-pointer">
                  <input type="radio" name="role" value="cajero" checked class="peer sr-only">
                    <div class="p-3 rounded-xl border border-gray-200 text-center font-bold text-gray-400 peer-checked:bg-black peer-checked:text-white transition">Cajero</div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="role" value="kiosco" class="peer sr-only">
                    <div class="p-3 rounded-xl border border-gray-200 text-center font-bold text-gray-400 peer-checked:bg-purple-600 peer-checked:text-white transition">Kiosco</div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="role" value="admin" class="peer sr-only">
                    <div class="p-3 rounded-xl border border-gray-200 text-center font-bold text-gray-400 peer-checked:bg-red-500 peer-checked:text-white transition">Admin</div>
                </label>
              </div>
            </div>

            <div class="pt-4 flex gap-3">
              <button type="button" id="btn-cancel-user" class="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition">Cancelar</button>
              <button type="submit" class="flex-1 bg-black hover:bg-gray-800 text-white py-3 rounded-xl font-bold shadow-lg transition">Crear Cuenta</button>
            </div>
          </form>
        </div>
      </div>
    `;

  // LOAD USERS
  const loadUsers = async () => {
    const { data: users, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('users-table-body');

    if (error) {
      tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-red-500">Error al cargar: ${error.message}</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr class="border-b border-gray-50 hover:bg-gray-50 transition">
          <td class="p-4 font-medium text-gray-800">${u.full_name || 'Sin nombre'}</td>
          <td class="p-4">${u.email}</td>
          <td class="p-4">
              <span class="px-3 py-1 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-red-100 text-red-600' :
        u.role === 'kiosco' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'
      }">
                  ${u.role.toUpperCase()}
              </span>
          </td>
          <td class="p-4 text-right flex justify-end gap-2">
              <button onclick="window.editUser('${u.id}', '${u.full_name}', '${u.role}')" class="p-2 text-gray-400 hover:text-blue-500 transition" title="Editar">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
              </button>
              <button onclick="window.deleteUser('${u.id}', '${u.email}')" class="p-2 text-gray-400 hover:text-red-500 transition" title="Eliminar">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
              </button>
          </td>
      </tr>
      `).join('');
  };

  loadUsers();

  // MODAL LOGIC
  const modal = document.getElementById('user-modal');
  const modalContent = document.getElementById('user-modal-content');
  const openModal = () => {
    modal.classList.remove('hidden');
    setTimeout(() => {
      modalContent.classList.remove('scale-95', 'opacity-0');
      modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
  };
  const closeModal = () => {
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
    document.getElementById('new-user-form').reset();
  };

  document.getElementById('btn-new-user').addEventListener('click', openModal);
  document.getElementById('btn-cancel-user').addEventListener('click', closeModal);

  // DELETE USER
  window.deleteUser = async (id, email) => {
    if (id === store.user.id) return alert("No puedes eliminar tu propia cuenta.");
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario ${email}? \nEsta acción no se puede deshacer.`)) return;

    try {
      const { error } = await supabase.rpc('delete_user_admin', { target_id: id });
      if (error) throw error;
      showToast('🗑️ Usuario eliminado correctamente');
      loadUsers();
    } catch (err) {
      console.error(err);
      alert("Error al eliminar: " + err.message);
    }
  };

  // EDIT USER (Simple Role/Name Change)
  window.editUser = async (id, currentName, currentRole) => {
    const newName = prompt("Nuevo nombre:", currentName);
    if (newName === null) return;

    const newRole = prompt("Nuevo rol (admin, cajero, kiosco):", currentRole);
    if (newRole === null) return;

    if (!['admin', 'cajero', 'kiosco'].includes(newRole.toLowerCase())) {
      return alert("Rol inválido. Use: admin, cajero, kiosco");
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName, role: newRole.toLowerCase() })
        .eq('id', id);

      if (error) throw error;
      showToast('✅ Usuario actualizado');
      loadUsers();
    } catch (err) {
      console.error(err);
      alert("Error al editar: " + err.message);
    }
  };

  // CREATE USER LOGIC (MAGIC RPC)
  document.getElementById('new-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-user-name').value;
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-pass').value;
    const role = document.querySelector('input[name="role"]:checked').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = "Creando...";

    try {
      // Import createClient dynamically from Supabase CDN
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

      const tempClient = createClient("https://bhogdzrahsoyqpnmkxfz.supabase.co", "sb_publishable_kAWgCzmqlq6ExNzSN98CAw__xUt9sdQ", {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      // 1. Create Auth User
      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email,
        password
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario");

      const newId = authData.user.id;

      // 2. Assign Role & Name via ADMIN RPC
      const { error: rpcError } = await supabase.rpc('create_profile_manual', {
        new_id: newId,
        new_email: email,
        new_role: role,
        new_name: name
      });

      if (rpcError) throw rpcError;

      alert(`Usuario creado correctamente: \n${email} - ${role} `);
      closeModal();
      loadUsers();

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "Crear Cuenta";
    }
  });
}

// --- ORDERS HISTORY (CASHIER & ADMIN) ---

async function renderOrdersHistory(container) {
  let allOrders = [];
  let currentFilter = 'all';
  let searchQuery = '';

  container.innerHTML = `
    <div class="space-y-8 animate-fade-in pb-24">
      <!-- Header & Stats -->
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h2 class="text-4xl font-black text-gray-800 tracking-tight">Pedidos del Día</h2>
            <p class="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Historial de ventas y gestión de órdenes</p>
          </div>
          
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full lg:w-auto">
             <div class="bg-white px-6 py-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex flex-col justify-center">
                <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Venta Total</p>
                <p id="orders-grand-total" class="text-xl font-black text-primary">Bs. 0.00</p>
             </div>
             <div class="bg-white px-6 py-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex flex-col justify-center">
                <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Órdenes</p>
                <p id="orders-count" class="text-xl font-black text-gray-800">0</p>
             </div>
             <div class="bg-white px-6 py-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex flex-col justify-center border-l-4 border-l-green-500">
                <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 text-green-600">Total Efectivo</p>
                <p id="orders-cash-total" class="text-xl font-black text-gray-800">Bs. 0.00</p>
             </div>
             <div class="bg-white px-6 py-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex flex-col justify-center border-l-4 border-l-blue-500">
                <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 text-blue-600">Total QR</p>
                <p id="orders-qr-total" class="text-xl font-black text-gray-800">Bs. 0.00</p>
             </div>
          </div>
      </div>

      <!-- Filters & Search Bar -->
      <div class="flex flex-col md:flex-row gap-4">
          <div class="relative flex-1">
             <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
             <input type="text" id="order-search" placeholder="Buscar por cliente o ID..." 
                    class="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-gray-100 shadow-sm focus:border-primary outline-none transition-all font-bold text-sm"
                    oninput="window.handleOrderSearch(this.value)">
          </div>
          
          <div class="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto scrollbar-hide" id="order-filters">
             <button onclick="window.filterOrdersByType('all')"   id="filter-all"   class="px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-black text-white shrink-0">Todos</button>
             <button onclick="window.filterOrdersByType('mesa')"  id="filter-mesa"  class="px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all text-gray-400 hover:text-gray-600 shrink-0">Mesa</button>
             <button onclick="window.filterOrdersByType('llevar')" id="filter-llevar" class="px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all text-gray-400 hover:text-gray-600 shrink-0">Llevar</button>
             <button onclick="window.filterOrdersByType('whatsapp')" id="filter-whatsapp" class="px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all text-gray-400 hover:text-gray-600 shrink-0">Envío</button>
          </div>
      </div>

      <!-- Orders List -->
      <div id="orders-list-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div class="col-span-full py-24 flex flex-col items-center justify-center text-gray-300">
              <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
              <p class="font-black uppercase tracking-widest text-xs">Cargando bitácora...</p>
          </div>
      </div>
    </div>
  `;

  // Local helper (closures over current state)
  const renderList = () => {
    let filtered = allOrders;
    if (currentFilter !== 'all') {
      filtered = filtered.filter(o => o.order_type === currentFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        (o.customer_name?.toLowerCase().includes(q)) ||
        (String(o.id).includes(q)) ||
        (o.customer_phone?.includes(q))
      );
    }

    const grid = document.getElementById('orders-list-grid');
    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-24 flex flex-col items-center justify-center text-gray-300 bg-white rounded-[3rem] border border-gray-100 animate-fade-in text-center">
            <span class="text-6xl mb-4">📖</span>
            <p class="text-xl font-black text-gray-500">No se encontraron registros</p>
            <p class="text-[10px] font-black uppercase tracking-widest text-gray-300 mt-2">Prueba con otros filtros o busca algo distinto</p>
        </div>
      `;
    } else {
      grid.innerHTML = filtered.map(order => {
        const time = new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const items = order.order_items || [];
        const total = order.total_amount || 0;

        const typeConfig = {
          mesa: { color: 'bg-blue-100 text-blue-600', icon: '🍴', label: 'Local' },
          llevar: { color: 'bg-green-100 text-green-600', icon: '🥡', label: 'Llevar' },
          whatsapp: { color: 'bg-orange-100 text-orange-600', icon: '🚚', label: 'Envío' }
        };
        const conf = typeConfig[order.order_type] || { color: 'bg-gray-100 text-gray-600', icon: '📝', label: order.order_type };

        return `
          <div class="bg-white rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 overflow-hidden flex flex-col group animate-fade-in-up">
              <div class="p-6 border-b border-gray-50 flex justify-between items-start">
                  <div>
                      <div class="flex items-center gap-2 mb-2">
                        <span class="px-2 py-1 bg-gray-50 text-gray-400 text-[8px] font-black rounded-lg uppercase tracking-widest border border-gray-100">#${String(order.id).slice(-4)}</span>
                        <span class="${conf.color} px-2 py-1 text-[8px] font-black rounded-lg uppercase tracking-widest">${conf.icon} ${conf.label}</span>
                      </div>
                      <h3 class="text-xl font-black text-gray-800 leading-tight capitalize truncate w-40">${(order.customer_name || 'Cliente').toLowerCase()}</h3>
                      <p class="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">🕒 ${time}</p>
                  </div>
                  <div class="text-right">
                      <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Total</p>
                      <p class="text-2xl font-black text-gray-900">Bs. ${total.toFixed(2)}</p>
                  </div>
              </div>
              
              <div class="p-6 flex-1 bg-gray-50/30 overflow-y-auto max-h-40 scrollbar-hide">
                  <div class="space-y-2">
                    ${items.map(item => `
                      <div class="flex justify-between text-[11px] font-bold text-gray-500">
                        <span class="capitalize"><span class="text-gray-300 font-black mr-1">${item.quantity}x</span> ${(item.products?.name || 'Item').toLowerCase()}</span>
                        <span class="text-gray-800">Bs. ${(item.price_at_sale * item.quantity).toFixed(2)}</span>
                      </div>
                    `).join('')}
                  </div>
              </div>

              <div class="p-4 bg-white border-t border-gray-50 flex gap-2">
                   <button onclick="window.reprintOrderHistory('${order.id}')" class="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-800 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                      <span>🖨️</span> Ticket
                   </button>
                   ${order.customer_phone ? `
                     <a href="https://wa.me/${order.customer_phone}" target="_blank" class="w-12 h-12 bg-green-500 flex items-center justify-center rounded-2xl text-white shadow-lg shadow-green-500/20 hover:scale-105 transition active:scale-95">
                        <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.588-5.946 0-6.556 5.332-11.888 11.888-11.888 3.176 0 6.161 1.237 8.404 3.483 2.247 2.247 3.483 5.232 3.483 8.404 0 6.556-5.332 11.889-11.886 11.889-2.003 0-3.969-.505-5.711-1.465l-6.277 1.686zm4.073-6.102c1.728 1.157 3.52 1.765 5.318 1.765 5.501 0 9.976-4.475 9.976-9.976 0-2.659-1.036-5.16-2.915-7.04-1.88-1.879-4.381-2.915-7.041-2.915-5.511 0-9.986 4.475-9.986 9.987 0 1.885.522 3.731 1.51 5.317l-.988 3.61 3.726-.948zm12.923-3.605c-.267-.134-1.578-.778-1.823-.867-.245-.089-.423-.134-.601.134-.178.267-.69 0-.867-.134-.178-.134-.356-.044-.623-.178-1.554-.778-2.695-1.956-3.14-2.734-.178-.311-.019-.478.136-.633.14-.139.311-.356.467-.534.156-.178.209-.304.311-.534.103-.223.052-.423-.026-.556-.078-.134-.601-1.446-.823-1.979-.215-.523-.431-.453-.601-.462-.178-.009-.356-.009-.534-.009-.178 0-.467.067-.712.334-.245.267-.935.912-.935 2.224 0 1.312.956 2.58 1.054 2.714.098.134 1.881 2.872 4.557 4.027 2.676 1.155 2.676.771 3.165.723.489-.048 1.578-.644 1.801-1.267.225-.623.225-1.156.156-1.267-.067-.112-.245-.178-.511-.311z"/></svg>
                     </a>
                   ` : ''}
              </div>
          </div>
        `;
      }).join('');
    }

    // Update Stats
    const total = filtered.reduce((s, o) => s + (o.total_amount || 0), 0);
    const totalCash = filtered.filter(o => o.payment_method === 'cash' || o.payment_method === 'efectivo' || (o.payment_method && o.payment_method.toLowerCase().includes('cash'))).reduce((s, o) => s + (o.total_amount || 0), 0);
    const totalQR = filtered.filter(o => o.payment_method === 'qr' || (o.payment_method && o.payment_method.toLowerCase().includes('qr'))).reduce((s, o) => s + (o.total_amount || 0), 0);

    const totalEl = document.getElementById('orders-grand-total');
    const cashEl = document.getElementById('orders-cash-total');
    const qrEl = document.getElementById('orders-qr-total');
    const countEl = document.getElementById('orders-count');

    if (totalEl) totalEl.innerText = `Bs. ${total.toFixed(2)}`;
    if (cashEl) cashEl.innerText = `Bs. ${totalCash.toFixed(2)}`;
    if (qrEl) qrEl.innerText = `Bs. ${totalQR.toFixed(2)}`;
    if (countEl) countEl.innerText = filtered.length;
  };

  window.filterOrdersByType = (type) => {
    currentFilter = type;
    const btns = ['all', 'mesa', 'llevar', 'whatsapp'];
    btns.forEach(t => {
      const el = document.getElementById(`filter-${t}`);
      if (el) {
        if (t === type) {
          el.className = 'px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-black text-white shrink-0';
        } else {
          el.className = 'px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all text-gray-400 hover:text-gray-600 shrink-0';
        }
      }
    });
    renderList();
  };

  window.handleOrderSearch = (val) => {
    searchQuery = val;
    renderList();
  };

  window.reprintOrderHistory = async (id) => {
    const order = allOrders.find(o => String(o.id) === id);
    if (!order) return;
    const items = order.order_items.map(i => ({ product: i.products, quantity: i.quantity }));
    const html = generateReceiptHTML(order, items);
    printTicket(html);
    showToast('🖨️ Ticket de orden #' + String(id).slice(-4));
  };

  // Fetch
  const today = new Date(new Date().getTime() - (4 * 60 * 60 * 1000)).toISOString().split('T')[0];
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(*))')
    .gte('created_at', today + 'T00:00:00')
    .order('created_at', { ascending: false });

  if (!error) {
    allOrders = orders || [];
    renderList();
  } else {
    showToast('Error al cargar historial', 'error');
  }
}

// --- KIOSK MANAGER (FOR CASHIER) ---
async function renderKioskManagerView(container) {
  container.innerHTML = `
      <div class="space-y-8 animate-fade-in pb-20">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
               <h2 class="text-4xl font-black text-gray-800 tracking-tight">Pedidos Kiosco</h2>
               <p class="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Aprobación y Cobro de Clientes en Auto-servicio</p>
            </div>
            <button onclick="setView('kiosk-orders')" class="group flex items-center gap-2 bg-white px-6 py-3 rounded-2xl shadow-sm hover:shadow-md border border-gray-100 transition-all active:scale-95 font-black text-xs uppercase tracking-widest text-gray-600">
               <span class="group-hover:rotate-180 transition-transform duration-500">🔄</span> 
               Actualizar Lista
            </button>
        </div>

        <div id="kiosk-pending-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div class="col-span-full py-32 flex flex-col items-center justify-center text-gray-300">
                <div class="relative w-16 h-16 mb-6">
                   <div class="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
                   <div class="relative bg-white rounded-full p-4 shadow-xl border border-primary/10">
                      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                   </div>
                </div>
                <p class="font-black uppercase tracking-widest text-xs">Sincronizando con la nube...</p>
            </div>
        </div>
    </div>
  `;

  // Fetch pending orders from Kiosco
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(*))')
    .eq('status', 'pending')
    .eq('cashier_name', 'Kiosco')
    .order('created_at', { ascending: false });

  const listContainer = document.getElementById('kiosk-pending-list');
  if (error) {
    listContainer.innerHTML = `
      <div class="col-span-full bg-red-50 text-red-600 p-8 rounded-[2.5rem] border border-red-100 flex items-center gap-4">
         <span class="text-4xl">⚠️</span>
         <div>
            <p class="font-black uppercase text-sm">Error de Conexión</p>
            <p class="text-sm opacity-80">${error.message}</p>
         </div>
      </div>
    `;
    return;
  }

  if (!orders || orders.length === 0) {
    listContainer.innerHTML = `
      <div class="col-span-full py-32 flex flex-col items-center justify-center text-gray-300 bg-white rounded-[3rem] border border-gray-100 shadow-sm animate-fade-in">
            <div class="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mb-6">
                <span class="text-6xl">✨</span>
            </div>
            <p class="text-2xl font-black text-gray-800 tracking-tight">Todo despejado</p>
            <p class="font-bold text-xs uppercase tracking-widest text-gray-400 mt-2">No hay pedidos esperando aprobación</p>
        </div>
      `;
    return;
  }

  listContainer.innerHTML = orders.map(order => {
    const time = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const itemsHtml = order.order_items.map(item => `
      <div class="flex justify-between items-center py-3 border-b border-gray-50 last:border-0 group/item">
            <div class="flex items-center gap-3">
               <span class="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-xs font-black text-gray-800 group-hover/item:bg-primary group-hover/item:text-white transition-colors">${item.quantity}</span>
               <span class="text-sm font-bold text-gray-600 capitalize">${(item.products?.name || 'Producto').toLowerCase()}</span>
            </div>
            <span class="font-black text-sm text-gray-800">Bs. ${(item.price_at_sale * item.quantity).toFixed(2)}</span>
        </div>
      `).join('');

    return `
      <div class="bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-100 overflow-hidden flex flex-col group animate-fade-in-up">
            <!-- Header Card -->
            <div class="p-8 border-b border-gray-50 flex justify-between items-start bg-gradient-to-br from-white to-gray-50/50">
                <div>
                   <div class="flex items-center gap-2 mb-2">
                      <span class="px-3 py-1 bg-black text-white text-[9px] font-black rounded-lg uppercase tracking-widest">
                        #${String(order.id).slice(-4)}
                      </span>
                      <span class="${order.order_type === 'mesa' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'} px-3 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest">
                        ${order.order_type === 'mesa' ? '🍴 Local' : '🥡 Llevar'}
                      </span>
                   </div>
                   <h3 class="text-2xl font-black text-gray-800 leading-tight capitalize">${(order.customer_name || 'Sin Nombre').toLowerCase()}</h3>
                   <div class="flex items-center gap-2 mt-1">
                      <span class="text-xs text-gray-400 font-bold uppercase tracking-widest">🕒 ${time}</span>
                   </div>
                </div>
                <div class="text-right">
                   <p class="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Por Cobrar</p>
                   <p class="text-3xl font-black text-primary">Bs. ${order.total_amount.toFixed(2)}</p>
                </div>
            </div>
            
            <!-- Items Area -->
            <div class="p-8 flex-1">
                <div class="mb-4 flex items-center justify-between">
                   <h4 class="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Detalle del Pedido</h4>
                   <span class="h-px bg-gray-100 flex-1 ml-4"></span>
                </div>
                <div class="space-y-1">
                   ${itemsHtml}
                </div>
            </div>
            
            <!-- Actions Area -->
            <div class="p-6 bg-gray-50/50 border-t border-gray-50 flex flex-col gap-3">
                <div class="flex items-center justify-between mb-1">
                   <span class="text-[9px] font-black text-gray-300 uppercase tracking-widest">Registrar Pago</span>
                   <div class="h-px bg-gray-100 flex-1 ml-4"></div>
                </div>
                <div class="grid grid-cols-5 gap-3">
                    <button onclick="rejectKioskOrder('${order.id}')" 
                            class="col-span-1 bg-white hover:bg-red-50 text-red-300 hover:text-red-500 p-4 rounded-2xl border border-gray-200 transition-all active:scale-95 flex justify-center items-center shadow-sm" title="Rechazar Pedido">
                       <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                       </svg>
                    </button>
                    <button id="approve-cash-${order.id}" 
                            onclick="approveKioskOrder('${order.id}', 'cash')" 
                            class="col-span-2 bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-green-500/10 transition hover:scale-[1.02] active:scale-95 flex flex-col justify-center items-center gap-1">
                       <span class="text-xl">💵</span>
                       <span class="uppercase tracking-widest text-[9px]">Efectivo</span>
                    </button>
                    <button id="approve-qr-${order.id}" 
                            onclick="approveKioskOrder('${order.id}', 'qr')" 
                            class="col-span-2 bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-500/10 transition hover:scale-[1.02] active:scale-95 flex flex-col justify-center items-center gap-1">
                       <span class="text-xl">📱</span>
                       <span class="uppercase tracking-widest text-[9px]">Cobro QR</span>
                    </button>
                </div>
            </div>
        </div>
      `;
  }).join('');
}

// Approval Logic
window.approveKioskOrder = async (orderId, method = 'cash') => {
  const btnId = method === 'cash' ? `approve-cash-${orderId}` : `approve-qr-${orderId}`;
  const btn = document.getElementById(btnId);
  const otherBtnId = method === 'cash' ? `approve-qr-${orderId}` : `approve-cash-${orderId}`;
  const otherBtn = document.getElementById(otherBtnId);

  if (btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    if (otherBtn) otherBtn.disabled = true;
    btn.innerHTML = `<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>`;
  }

  if (!confirm(`¿Confirmar pago con ${method.toUpperCase()} y finalizar pedido?`)) {
    if (btn) {
      btn.disabled = false;
      if (otherBtn) otherBtn.disabled = false;
      btn.innerHTML = method === 'cash' ? '<span class="text-xl">💵</span><span class="uppercase tracking-widest text-[9px]">Efectivo</span>' : '<span class="text-xl">📱</span><span class="uppercase tracking-widest text-[9px]">Cobro QR</span>';
    }
    return;
  }

  // 1. Fetch full order details with items for printing
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('*, order_items(*, products(*))')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    return alert('Error al recuperar pedido: ' + fetchError?.message);
  }

  // 2. Prepare items for printer (format must match store.cart structure if using generateReceiptHTML)
  const cartForPrinter = order.order_items.map(item => ({
    product: item.products,
    quantity: item.quantity
  }));

  // 3. Status for ticket
  const ticketOrder = {
    ...order,
    payment_method: method.toUpperCase() + ' (Kiosco)'
  };

  // 4. Print Ticket
  const ticketHTML = generateReceiptHTML(ticketOrder, cartForPrinter);
  printTicket(ticketHTML);

  // 5. Update DB Status
  const numericId = parseInt(orderId);
  const { data: updatedData, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      payment_method: method,
      cashier_name: `Aprobado por ${store.user.role === 'admin' ? 'Admin' : 'Cajero'}`
    })
    .eq('id', numericId)
    .select();

  if (updateError) {
    alert('Pedido impreso pero error al actualizar estado: ' + updateError.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `💰 COBRAR Y FINALIZAR`;
    }
  } else if (!updatedData || updatedData.length === 0) {
    alert('Error: El pedido se imprimió pero no se pudo actualizar en la base de datos (0 filas afectadas). Verifica los permisos de RLS.');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `💰 COBRAR Y FINALIZAR`;
    }
  } else {
    showToast('🚀 Pedido Finalizado y Pagado', 'success');
    // Using setView ensures a complete re-render and state reset
    setView('kiosk-orders');
  }
};

window.rejectKioskOrder = async (orderId) => {
  if (!confirm('¿Seguro que deseas ELIMINAR este pedido pendiente?')) return;

  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) throw error;

    showToast('🗑️ Pedido eliminado correctamente');
    setView('kiosk-orders');
  } catch (err) {
    console.error(err);
    showToast('❌ Error al eliminar pedido', 'error');
  }
};

// Initial
render();
