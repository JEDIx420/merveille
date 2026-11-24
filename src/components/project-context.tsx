"use client";
import { createContext, useContext } from "react";
export const ProjectContext = createContext<any>(null);
export const useProject = () => useContext(ProjectContext);
