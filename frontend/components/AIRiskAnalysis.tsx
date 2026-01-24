'use client';

import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ShieldAlert, Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';
import { LoanDetails } from '@/lib/contract-calls';

interface RiskAnalysis {
  healthFactor: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  recommendation: string;
  liquidationPrice: number;
}

interface AIRiskAnalysisProps {
  loan?: LoanDetails;
  stxPrice?: number; // Current STX price in USD
}

const AIRiskAnalysis: React.FC<AIRiskAnalysisProps> = ({ loan, stxPrice = 0 }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeRisk = async () => {
    if (!loan || !loan.isActive) return;
    if (!stxPrice || stxPrice <= 0) {
      setError('Waiting for STX price from oracle...');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const collateralAmount = Number(loan.collateralAmount) / 1_000000; // Convert from micro-STX
      const borrowedAmount = Number(loan.borrowedAmount) / 1_000000; // Convert from micro-USDCx
      const collateralValue = collateralAmount * stxPrice;
      const healthFactor = collateralValue / borrowedAmount;

      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not found');
      }

      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `You are a DeFi risk analyst for StableLend, a lending protocol on Stacks (Bitcoin L2).

Analyze this loan position and provide risk assessment:

Loan Details:
- Collateral: ${collateralAmount.toFixed(2)} STX (currently worth $${collateralValue.toFixed(2)} at $${stxPrice}/STX)
- Borrowed: ${borrowedAmount.toFixed(6)} USDCx (stablecoin pegged to $1)
- Health Factor: ${healthFactor.toFixed(2)}

Health Factor Guide:
- Above 2.0 = Very Safe (collateral is 2x+ borrowed amount)
- 1.5-2.0 = Safe (good cushion)
- 1.2-1.5 = Moderate Risk (monitor closely)
- 1.0-1.2 = High Risk (add collateral soon)
- Below 1.0 = Critical (liquidation imminent)

Provide your analysis in this EXACT JSON format:
{
  "healthFactor": ${healthFactor.toFixed(2)},
  "riskLevel": "Low/Medium/High/Critical",
  "recommendation": "Specific actionable advice in 1-2 sentences",
  "liquidationPrice": calculated STX price that would trigger liquidation
}

Calculate liquidation price: The STX price at which health factor reaches 1.0 (collateral value equals borrowed amount).
Formula: liquidationPrice = borrowedAmount / collateralAmount

Be concise, friendly, and actionable. Focus on what the user should DO.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedAnalysis = JSON.parse(jsonMatch[0]);
        setAnalysis(parsedAnalysis);
      } else {
        // Fallback: create analysis from health factor
        const liquidationPrice = borrowedAmount / collateralAmount;
        let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
        let recommendation = '';

        if (healthFactor >= 2.0) {
          riskLevel = 'Low';
          recommendation = "Your position looks rock solid! You have plenty of collateral cushion. Keep monitoring market conditions.";
        } else if (healthFactor >= 1.5) {
          riskLevel = 'Low';
          recommendation = "Healthy position with good safety margin. Consider adding more collateral if STX price drops significantly.";
        } else if (healthFactor >= 1.2) {
          riskLevel = 'Medium';
          recommendation = "Your position is getting closer to liquidation risk. Consider adding more STX collateral or repaying part of your loan.";
        } else if (healthFactor >= 1.0) {
          riskLevel = 'High';
          recommendation = "⚠️ High risk! Add more collateral immediately or repay part of your loan to avoid liquidation.";
        } else {
          riskLevel = 'Critical';
          recommendation = "🚨 CRITICAL! Your position may be liquidated soon. Add collateral or repay NOW!";
        }

        setAnalysis({
          healthFactor,
          riskLevel,
          recommendation,
          liquidationPrice
        });
      }
    } catch (err) {
      console.error('AI Risk Analysis Error:', err);
      setError('Failed to analyze risk. Please try again.');
      
      // Fallback to basic calculation
      const collateralAmount = Number(loan.collateralAmount) / 1_000000;
      const borrowedAmount = Number(loan.borrowedAmount) / 1_000000;
      const collateralValue = collateralAmount * stxPrice;
      const healthFactor = collateralValue / borrowedAmount;
      const liquidationPrice = borrowedAmount / collateralAmount;

      let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
      if (healthFactor < 1.0) riskLevel = 'Critical';
      else if (healthFactor < 1.2) riskLevel = 'High';
      else if (healthFactor < 1.5) riskLevel = 'Medium';

      setAnalysis({
        healthFactor,
        riskLevel,
        recommendation: healthFactor >= 1.5 
          ? "Your position is healthy. Keep monitoring market conditions."
          : "Consider adding more collateral to improve your safety margin.",
        liquidationPrice
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze when loan changes
  useEffect(() => {
    if (loan && loan.isActive) {
      analyzeRisk();
    }
  }, [loan?.loanId, loan?.borrowedAmount, loan?.collateralAmount]);

  if (!loan || !loan.isActive) {
    return (
      <div className="glass-card p-6 rounded-3xl">
        <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-orange-500" />
          AI Risk Monitoring
        </h3>
        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
          <p className="text-xs text-green-200 leading-relaxed flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            No active loans. Your position is safe!
          </p>
        </div>
      </div>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'emerald';
      case 'Medium': return 'amber';
      case 'High': return 'orange';
      case 'Critical': return 'rose';
      default: return 'gray';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'Low': return <CheckCircle className="w-4 h-4" />;
      case 'Medium': return <AlertTriangle className="w-4 h-4" />;
      case 'High': return <AlertTriangle className="w-4 h-4" />;
      case 'Critical': return <AlertTriangle className="w-4 h-4" />;
      default: return <ShieldAlert className="w-4 h-4" />;
    }
  };

  const collateralAmount = Number(loan.collateralAmount) / 1_000000;
  const borrowedAmount = Number(loan.borrowedAmount) / 1_000000;
  const collateralValue = collateralAmount * stxPrice;

  return (
    <div className="glass-card p-6 rounded-3xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-bold text-white flex items-center gap-2">
          <div className="relative">
            <ShieldAlert className="w-4 h-4 text-orange-500" />
            {loading && (
              <Sparkles className="w-3 h-3 text-orange-400 absolute -top-1 -right-1 animate-pulse" />
            )}
          </div>
          AI Risk Monitoring
        </h3>
        {analysis && (
          <button
            onClick={analyzeRisk}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-orange-400 transition-colors disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Refresh'}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Loan Details */}
        <div className="flex justify-between items-center p-3 rounded-2xl bg-white/5 border border-white/5">
          <div>
            <p className="text-xs text-gray-400">Collateral</p>
            <p className="text-sm font-bold text-white">{collateralAmount.toFixed(2)} STX</p>
            <p className="text-xs text-gray-500">${collateralValue.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Borrowed</p>
            <p className="text-sm font-bold text-orange-500">{borrowedAmount.toFixed(6)} USDCx</p>
            <p className="text-xs text-gray-500">${borrowedAmount.toFixed(2)}</p>
          </div>
        </div>

        {loading ? (
          <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-orange-400 animate-spin" />
              <p className="text-xs text-orange-200">AI analyzing your position...</p>
            </div>
          </div>
        ) : analysis ? (
          <>
            {/* Health Factor */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Health Factor</span>
                <span className={`text-2xl font-black ${
                  analysis.healthFactor >= 2.0 ? 'text-emerald-400' : 
                  analysis.healthFactor >= 1.5 ? 'text-green-400' :
                  analysis.healthFactor >= 1.2 ? 'text-amber-400' :
                  analysis.healthFactor >= 1.0 ? 'text-orange-400' : 'text-rose-500'
                }`}>
                  {analysis.healthFactor.toFixed(2)}
                </span>
              </div>
              <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    analysis.healthFactor >= 2.0 ? 'bg-emerald-500' : 
                    analysis.healthFactor >= 1.5 ? 'bg-green-500' :
                    analysis.healthFactor >= 1.2 ? 'bg-amber-500' :
                    analysis.healthFactor >= 1.0 ? 'bg-orange-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(analysis.healthFactor * 50, 100)}%` }}
                />
              </div>
            </div>

            {/* Risk Level */}
            <div className={`p-4 rounded-2xl bg-${getRiskColor(analysis.riskLevel)}-500/10 border border-${getRiskColor(analysis.riskLevel)}-500/20`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Risk Level</span>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-${getRiskColor(analysis.riskLevel)}-500/20 text-${getRiskColor(analysis.riskLevel)}-400`}>
                  {getRiskIcon(analysis.riskLevel)}
                  {analysis.riskLevel}
                </div>
              </div>
              <div className={`text-xs text-${getRiskColor(analysis.riskLevel)}-200 leading-relaxed`}>
                Liquidation at: <span className="font-bold">${analysis.liquidationPrice.toFixed(2)}/STX</span>
                {stxPrice > analysis.liquidationPrice && (
                  <span className="ml-2 text-gray-400">
                    ({((1 - analysis.liquidationPrice / stxPrice) * 100).toFixed(0)}% buffer)
                  </span>
                )}
              </div>
            </div>

            {/* AI Recommendation */}
            <div className={`p-4 rounded-2xl bg-${getRiskColor(analysis.riskLevel)}-500/10 border border-${getRiskColor(analysis.riskLevel)}-500/20`}>
              <div className="flex items-start gap-3">
                <Sparkles className={`w-4 h-4 text-${getRiskColor(analysis.riskLevel)}-400 flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-gray-300 mb-2">AI Recommendation</h4>
                  <p className={`text-sm text-${getRiskColor(analysis.riskLevel)}-200 leading-relaxed`}>
                    {analysis.recommendation}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-200">{error}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AIRiskAnalysis;
