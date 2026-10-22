import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import appDataReducer from './appDataSlice.js';

const rootReducer = combineReducers({
  appData: appDataReducer,
});

const persistedReducer = persistReducer({
  key: 'thandal-root',
  storage,
  whitelist: ['appData'],
}, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: {
      ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE', 'persist/PAUSE', 'persist/PURGE', 'persist/REGISTER', 'persist/FLUSH'],
    },
  }),
});

export const persistor = persistStore(store);
