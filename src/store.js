import { supabase } from './services/supabase.js';

export const store = {
    user: null,
    customerName: '', // For public Kiosk access
    posCustomerName: '', // For POS access
    cart: [],
    branches: [],
    activeBranchId: localStorage.getItem('activeBranchId'),
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

    async fetchUserBranches() {
        if (!this.user) return;
        
        // Kiosk users don't need branches in the same way, but let's fetch for staff
        if (this.user.role === 'cliente' || this.user.role === 'kiosco') return;

        let query = supabase.from('branches').select('*');
        
        if (this.user.role !== 'admin') {
            const { data: profileBranches } = await supabase
                .from('profile_branches')
                .select('branch_id')
                .eq('profile_id', this.user.id);
            
            const branchIds = profileBranches?.map(pb => pb.branch_id) || [];
            if (branchIds.length > 0) {
                query = query.in('id', branchIds);
            } else {
                this.branches = [];
                this.activeBranchId = null;
                this.notify();
                return;
            }
        }

        const { data: branches, error } = await query;
        if (error) console.error('Error fetching branches:', error);
        
        this.branches = branches || [];
        
        // Pick active branch
        const exists = this.branches.find(b => b.id == this.activeBranchId);
        if (!this.activeBranchId || !exists) {
            this.activeBranchId = this.branches[0]?.id || null;
            if (this.activeBranchId) {
                localStorage.setItem('activeBranchId', this.activeBranchId);
            }
        }
        this.notify();
    },

    setActiveBranch(id) {
        this.activeBranchId = id;
        localStorage.setItem('activeBranchId', id);
        this.notify();
    },

    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error };

        if (data.user) {
            // Fetch Role from Profiles
            let { data: profile } = await supabase
                .from('profiles')
                .select('role, full_name')
                .eq('id', data.user.id)
                .maybeSingle();

            if (!profile) {
                const { data: newProfile } = await supabase
                    .from('profiles')
                    .insert({
                        id: data.user.id,
                        email: data.user.email,
                        role: 'cajero', 
                        full_name: data.user.user_metadata?.full_name || data.user.email
                    })
                    .select()
                    .maybeSingle();
                profile = newProfile;
            }

            let role = profile ? profile.role : 'cajero';
            if (data.user.email === 'admin@gmail.com') role = 'admin';

            this.user = {
                ...data.user,
                role: role,
                full_name: profile?.full_name || data.user.user_metadata?.full_name || data.user.email
            };
            
            await this.fetchUserBranches();
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
            let { data: profile } = await supabase
                .from('profiles')
                .select('role, full_name')
                .eq('id', user.id)
                .maybeSingle();

            if (!profile) {
                const { data: newProfile } = await supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        email: user.email,
                        role: 'cliente',
                        full_name: user.user_metadata?.full_name || user.email
                    })
                    .select()
                    .maybeSingle();
                profile = newProfile;
            }

            let role = profile ? profile.role : 'cliente';
            if (user.email === 'admin@gmail.com') role = 'admin';

            this.user = {
                ...user,
                role: role,
                full_name: profile?.full_name || user.user_metadata?.full_name || user.email
            };

            if (this.user.role === 'cliente') {
                this.customerName = this.user.full_name;
            } else {
                await this.fetchUserBranches();
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
        this.branches = [];
        this.activeBranchId = null;
        localStorage.removeItem('activeBranchId');
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
        const item = this.cart.find(i => i.product.id == productId);
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
    },

    get activeBranch() {
        return this.branches.find(b => b.id == this.activeBranchId) || null;
    }
};
