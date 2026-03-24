import { supabase } from './services/supabase.js';

export const store = {
    user: null,
    customerName: '', // For public Kiosk access
    posCustomerName: '', // For POS access
    cart: [],
    currentSession: null, // Cash register session

    // POS State
    orderType: 'mesa', // mesa, llevar, whatsapp
    posPaymentMethod: 'cash', // cash, qr
    whatsappDetails: { phone: '', location: '', advance: 0, paymentMethod: 'qr' },
    autoPrint: false, // New: Toggle for automatic printing

    // UI State
    uiState: {
        isSidebarCollapsed: false,
        isMobileMenuOpen: false
    },

    // Reactive listeners
    listeners: [],

    subscribe(fn) {
        this.listeners.push(fn);
    },

    notify() {
        this.listeners.forEach(fn => fn(this));
    },

    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error };

        if (data.user) {
            // Fetch Role from Profiles
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, full_name')
                .eq('id', data.user.id)
                .single();

            this.user = {
                ...data.user,
                role: profile ? profile.role : 'cajero', // Default to cashier if no profile found
                full_name: profile?.full_name || data.user.user_metadata?.full_name || data.user.email
            };
            this.notify();
        }
        return { data };
    },

    async loginWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        return { data, error };
    },

    async checkSession() {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
            const user = data.session.user;
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, full_name')
                .eq('id', user.id)
                .single();

            this.user = {
                ...user,
                role: profile ? profile.role : 'cliente',
                full_name: profile?.full_name || user.user_metadata?.full_name || user.email
            };

            if (this.user.role === 'cliente') {
                this.customerName = this.user.full_name;
            }

            this.notify();
            return true;
        }
        return false;
    },

    async logout() {
        await supabase.auth.signOut();
        this.user = null;
        this.cart = [];
        this.notify();
    },

    addToCart(product, quantity = 1) {
        const existing = this.cart.find(i => i.product.id === product.id);
        if (existing) {
            existing.quantity += quantity;
        } else {
            this.cart.push({ product, quantity });
        }
        this.notify();
    },

    updateCartQuantity(productId, delta) {
        const item = this.cart.find(i => i.product.id === productId);
        if (item) {
            item.quantity += delta;
            if (item.quantity <= 0) {
                this.cart = this.cart.filter(i => i.product.id !== productId);
            }
            this.notify();
        }
    },

    clearCart() {
        this.cart = [];
        this.notify();
    },

    get cartTotal() {
        return this.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    }
};
