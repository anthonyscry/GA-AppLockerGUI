
import { GoogleGenAI } from "@google/genai";

// Guideline: Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
export const analyzeAppLockerPolicy = async (policyContext: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this AppLocker policy context for a GA-AppLocker implementation and provide a security risk assessment. 
    Context: ${policyContext}. 
    Reference the 4-Phase Deployment Guide: 
    Phase 1 (EXE), Phase 2 (Script), Phase 3 (MSI), Phase 4 (DLL). 
    Check for: 1. Overly broad rules, 2. Path vulnerabilities (e.g., %TEMP%), 3. LOLBin exclusion status.`,
    config: {
      temperature: 0.7,
      maxOutputTokens: 500,
    }
  });
  return response.text;
};

export const getComplianceSnippet = async (framework: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Provide a short technical snippet for a GA-AppLocker CORA evidence package explaining how AppLocker fulfills ${framework} controls for software white-listing and integrity.`,
  });
  return response.text;
};

export const askConsultant = async (question: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: question,
    config: {
      systemInstruction: "You are Tony Tran, ISSO at GA-ASI and author of the GA-AppLocker toolkit. You are a world-class expert in Windows Application Control. Provide professional, concise, and highly secure advice. Always emphasize the importance of 14-day audit periods and the danger of DLL enforcement (Phase 4). Mention specific GA-AppLocker scripts like Invoke-RemoteScan or Test-RuleHealth where relevant.",
    }
  });
  return response.text;
};
