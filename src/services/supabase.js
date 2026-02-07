// CREDENTIALS - Using standard Vite env variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bhogdzrahsoyqpnmkxfz.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_kAWgCzmqlq6ExNzSN98CAw__xUt9sdQ";

// Mock Data Store (In-memory for demo)
const mockDb = {
  products: [
    { id: 1, name: "Hamburguesa Clásica", price: 25.0, cost: 15.0, description: "Carne de res, lechuga, tomate", image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500" },
    { id: 2, name: "Papas Fritas", price: 10.0, cost: 5.0, description: "Crocantes y doradas", image_url: "https://images.unsplash.com/photo-1573080496987-a199f8cd4054?w=500" },
    { id: 3, name: "Refresco 500ml", price: 8.0, cost: 4.0, description: "Coca-Cola o Fanta", image_url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500" },
    { id: 4, name: "Pollo Broaster", price: 30.0, cost: 18.0, description: "Con arroz y papas", image_url: "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=500" }
  ],
  orders: [],
  order_items: [],
  cash_register_sessions: []
};

// Simple Mock Client
class MockSupabase {
  constructor() {
    console.log("⚠️ RUNNING IN DEMO MODE (Mock Data)");
    this.auth = {
      getUser: async () => ({ data: { user: { role: 'admin' } }, error: null }),
      signInWithPassword: async () => ({ data: { user: { role: 'admin' } }, error: null }),
      signOut: async () => ({ error: null })
    };
  }

  from(table) {
    return new MockQueryBuilder(table);
  }
}

class MockQueryBuilder {
  constructor(table) {
    this.table = table;
    this.data = mockDb[table] || [];
    this.filters = [];
  }

  select(columns) {
    // Return all for simplicity in demo
    return this;
  }

  insert(row) {
    const newItem = { id: Date.now(), ...row, created_at: new Date().toISOString() };
    if (mockDb[this.table]) {
      mockDb[this.table].push(newItem);
    }
    return { data: [newItem], error: null, select: () => ({ data: [newItem], error: null }) };
  }

  update(updates) {
    // Simplified update mocking
    return {
      data: [], error: null, eq: (col, val) => {
        // finding and updating in memory would go here
        return { data: [], error: null };
      }
    };
  }

  eq(column, value) {
    if (column === 'id') {
      // simple filter
    }
    return this; // Chainable
  }

  order(col, { ascending }) {
    return { data: this.data, error: null }; // return data immediately for demo
  }

  // Fake execution
  then(callback) {
    callback({ data: this.data, error: null });
  }
}

// Check if we have secrets, otherwise use Mock
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : new MockSupabase();
