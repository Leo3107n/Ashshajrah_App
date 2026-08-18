"use client";

import { createContext, useContext } from "react";

const DashboardSessionContext = createContext(null);

export function DashboardSessionProvider({ session, children }) {
  return (
    <DashboardSessionContext.Provider value={session || null}>
      {children}
    </DashboardSessionContext.Provider>
  );
}

export function useDashboardSession() {
  return useContext(DashboardSessionContext);
}
