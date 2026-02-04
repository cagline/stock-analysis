import { configureStore } from '@reduxjs/toolkit';
import type { ThunkAction, Action } from '@reduxjs/toolkit';
import { counterReducer } from '../features/counter';
import appReducer from '../appSlice';
import { portfolioReducer } from '../features/portfolio';
import { todoApiSlice } from '../features/todo';

export const store = configureStore({
  reducer: {
    counter: counterReducer,
    app: appReducer,
    portfolio: portfolioReducer,
    [todoApiSlice.reducerPath] : todoApiSlice.reducer,
  },
  middleware: getDefaultMiddleware =>
      getDefaultMiddleware().concat(todoApiSlice.middleware)
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
