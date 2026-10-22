import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiRequest } from '../services/api.js';
import { DEFAULT_SETTINGS } from '../utils/collections.js';

export const loadDashboardData = createAsyncThunk('appData/loadDashboard', async () => {
  const [health, settings, entries] = await Promise.all([
    apiRequest('/health'),
    apiRequest('/settings'),
    apiRequest('/entries'),
  ]);
  return { health, settings: { ...DEFAULT_SETTINGS, ...settings }, entries };
});

export const saveSettings = createAsyncThunk('appData/saveSettings', (settings) => apiRequest('/settings', {
  method: 'POST',
  data: settings,
}));

export const saveEntry = createAsyncThunk('appData/saveEntry', (entry) => apiRequest('/entries', {
  method: 'POST',
  data: entry,
}));

export const deleteEntry = createAsyncThunk('appData/deleteEntry', (id) => apiRequest(`/entries/${id}`, {
  method: 'DELETE',
}));

export const loadCustomers = createAsyncThunk('appData/loadCustomers', () => apiRequest('/customers'));

export const addCustomer = createAsyncThunk('appData/addCustomer', (customer) => apiRequest('/customers', {
  method: 'POST',
  data: customer,
}));

export const initialAppData = {
  accountMobile: '',
  settings: DEFAULT_SETTINGS,
  entries: [],
  customers: [],
};

const appDataSlice = createSlice({
  name: 'appData',
  initialState: initialAppData,
  reducers: {
    setAccountMobile(state, action) {
      if (state.accountMobile && state.accountMobile !== action.payload) {
        state.settings = DEFAULT_SETTINGS;
        state.entries = [];
        state.customers = [];
      }
      state.accountMobile = action.payload;
    },
    clearAccountData() {
      return initialAppData;
    },
    updateSettingDraft(state, action) {
      state.settings = { ...state.settings, ...action.payload };
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loadDashboardData.fulfilled, (state, action) => {
        state.settings = action.payload.settings;
        state.entries = action.payload.entries;
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.settings = { ...DEFAULT_SETTINGS, ...action.payload };
      })
      .addCase(saveEntry.fulfilled, (state, action) => {
        const saved = action.payload;
        state.entries = [saved, ...state.entries.filter((row) => !(row.date === saved.date && row.type === saved.type))]
          .sort((first, second) => second.date.localeCompare(first.date) || String(second.updatedAt || '').localeCompare(String(first.updatedAt || '')));
      })
      .addCase(deleteEntry.fulfilled, (state, action) => {
        state.entries = state.entries.filter((row) => row._id !== action.meta.arg);
      })
      .addCase(loadCustomers.fulfilled, (state, action) => {
        state.customers = action.payload;
      })
      .addCase(addCustomer.fulfilled, (state, action) => {
        state.customers = [...state.customers, action.payload]
          .sort((first, second) => first.name.localeCompare(second.name));
      });
  },
});

export const { clearAccountData, setAccountMobile, updateSettingDraft } = appDataSlice.actions;
export default appDataSlice.reducer;
