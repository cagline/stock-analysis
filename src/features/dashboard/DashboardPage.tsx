import React from 'react';
import { TodoPage } from "../todo";
import { CounterPage } from "../counter";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const {t, i18n} = useTranslation();


  return (
    <div >
      <h2>{t('dashboard')}</h2>
      <div style={{display: 'flex', flexWrap: 'wrap'}}>
      <TodoPage/>
      <CounterPage/>
      </div>
    </div>
  );
}
