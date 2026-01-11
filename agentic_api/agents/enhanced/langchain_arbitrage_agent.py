"""
Enhanced Arbitrage Agent using LangChain with delegation to simple agents
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import asyncio
import time

try:
    from langchain_openai import ChatOpenAI
    from langchain.schema import HumanMessage, SystemMessage
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    print("⚠️ LangChain not available, using fallback mode")

from agents.simple.base import BaseAgent
from agents.simple.arbitrage_detector_agent import ArbitrageDetectorAgent


class LangChainArbitrageAgent(BaseAgent):
    """Enhanced arbitrage agent using LangChain for intelligent reasoning, delegating calculations to simple agents"""
    
    def __init__(self, openai_api_key: Optional[str] = None):
        super().__init__("LangChainArbitrageAgent")
        
        # Initialize the simple arbitrage detector agent for calculations
        self.arbitrage_detector = ArbitrageDetectorAgent()
        
        # Initialize LangChain components if available
        self.llm = None
        self.langchain_enabled = False
        
        if LANGCHAIN_AVAILABLE and openai_api_key:
            try:
                self.llm = ChatOpenAI(
                    model="gpt-4o-mini",
                    temperature=0.1,
                    api_key=openai_api_key
                )
                self.langchain_enabled = True
                print("✅ LangChain agent initialized with OpenAI")
            except Exception as e:
                print(f"⚠️ Failed to initialize LangChain: {e}")
                self.langchain_enabled = False
        else:
            print("⚠️ LangChain or OpenAI API key not available, using simple agent delegation")
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute arbitrage analysis by delegating to simple agents with optional LangChain enhancement"""
        try:
            # Delegate the actual calculation to the simple arbitrage detector
            result = await self.arbitrage_detector.execute(input_data)
            
            # If LangChain is available, enhance with AI reasoning
            if self.langchain_enabled and self.llm and result.get("status") == "success":
                try:
                    reasoning = await self._get_langchain_reasoning(input_data, result)
                    result["ai_reasoning"] = reasoning
                    result["enhanced_analysis"] = True
                except Exception as e:
                    print(f"⚠️ LangChain reasoning failed: {e}")
                    result["enhanced_analysis"] = False
            else:
                result["enhanced_analysis"] = False
            
            return result
                
        except Exception as e:
            print(f"❌ Error in LangChain arbitrage analysis: {e}")
            return {"status": "error", "error": str(e)}
    
    async def _get_langchain_reasoning(self, input_data: Dict[str, Any], calculation_result: Dict[str, Any]) -> str:
        """Get LangChain reasoning about the calculation results"""
        if not self.langchain_enabled or not self.llm:
            return "LangChain reasoning not available"
        
        try:
            action = input_data.get("action", "analysis")
            
            # Create a focused prompt based on the action
            if action == "getcharges":
                prompt = self._create_charges_analysis_prompt(input_data, calculation_result)
            elif action == "isprofitable":
                prompt = self._create_profitability_analysis_prompt(input_data, calculation_result)
            elif action == "possibilities":
                prompt = self._create_opportunities_analysis_prompt(input_data, calculation_result)
            else:
                prompt = self._create_general_analysis_prompt(input_data, calculation_result)
            
            messages = [
                SystemMessage(content="You are an expert DeFi arbitrage analyst specializing in Aptos ecosystem. Provide concise, actionable insights."),
                HumanMessage(content=prompt)
            ]
            
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                self.llm.invoke,
                messages
            )
            
            return response.content
            
        except Exception as e:
            return f"LangChain reasoning failed: {str(e)}"
    
    def _create_charges_analysis_prompt(self, input_data: Dict[str, Any], result: Dict[str, Any]) -> str:
        """Create prompt for charges analysis"""
        charges = result.get("charges", {})
        total_costs = charges.get("total_costs", {})
        
        return f"""
Analyze these arbitrage charges for Aptos trading:

TRADE DETAILS:
- Route: {result.get("route", {}).get("from_pair", "N/A")} → {result.get("route", {}).get("to_pair", "N/A")}
- DEXs: {result.get("route", {}).get("from_dex", "N/A")} → {result.get("route", {}).get("to_dex", "N/A")}
- Trade Amount: ${result.get("route", {}).get("trade_amount", 0):,.2f}

COST BREAKDOWN:
- Trading Fees: ${charges.get("summary", {}).get("breakdown", {}).get("trading_fees", 0):.4f}
- Gas Costs: ${charges.get("summary", {}).get("breakdown", {}).get("gas_costs", 0):.4f}
- Slippage: ${charges.get("summary", {}).get("breakdown", {}).get("slippage", 0):.4f}
- Total Costs: ${total_costs.get("total_fees_usd", 0):.4f} ({total_costs.get("cost_percentage", 0):.2f}% of trade)

Provide a brief analysis focusing on:
1. Are these costs reasonable for this trade size?
2. Which cost component is the highest concern?
3. Any optimization suggestions?

Keep response under 150 words.
"""
    
    def _create_profitability_analysis_prompt(self, input_data: Dict[str, Any], result: Dict[str, Any]) -> str:
        """Create prompt for profitability analysis"""
        profitability = result.get("profitability", {})
        
        return f"""
Analyze this Aptos arbitrage opportunity:

OPPORTUNITY:
- Route: {result.get("route", {}).get("from_pair", "N/A")} → {result.get("route", {}).get("to_pair", "N/A")}
- DEXs: {result.get("route", {}).get("from_dex", "N/A")} → {result.get("route", {}).get("to_dex", "N/A")}
- Trade Amount: ${result.get("route", {}).get("trade_amount", 0):,.2f}

PROFITABILITY:
- Profitable: {profitability.get("is_profitable", False)}
- Gross Profit: ${profitability.get("gross_profit_usd", 0):.4f}
- Net Profit: ${profitability.get("net_profit_usd", 0):.4f}
- Profit Margin: {profitability.get("profit_margin_percent", 0):.2f}%
- Recommendation: {result.get("recommendation", "N/A")}
- Risk Level: {result.get("risk_level", "N/A")}

Provide insights on:
1. Is this opportunity worth executing?
2. What are the main risks?
3. Market timing considerations?

Keep response under 150 words.
"""
    
    def _create_opportunities_analysis_prompt(self, input_data: Dict[str, Any], result: Dict[str, Any]) -> str:
        """Create prompt for opportunities analysis"""
        opportunities = result.get("opportunities", {})
        market_summary = result.get("market_summary", {})
        
        return f"""
Analyze these Aptos arbitrage opportunities:

SEARCH RESULTS:
- Total Opportunities Found: {opportunities.get("total_found", 0)}
- Profitable Count: {opportunities.get("profitable_count", 0)}
- Best Profit Margin: {market_summary.get("best_profit_margin", 0):.2f}%
- Average Profit Margin: {market_summary.get("average_profit_margin", 0):.2f}%
- Recommended Trades: {market_summary.get("recommended_trades", 0)}

TOP OPPORTUNITIES:
{self._format_top_opportunities(opportunities.get("top_opportunities", []))}

Provide strategic insights on:
1. Overall market conditions for arbitrage
2. Which opportunities to prioritize
3. Risk management recommendations

Keep response under 200 words.
"""
    
    def _create_general_analysis_prompt(self, input_data: Dict[str, Any], result: Dict[str, Any]) -> str:
        """Create general analysis prompt"""
        return f"""
Analyze this Aptos arbitrage analysis result:

INPUT: {json.dumps(input_data, indent=2)[:500]}...
RESULT: {json.dumps(result, indent=2)[:500]}...

Provide brief insights on the analysis and any recommendations.
Keep response under 100 words.
"""
    
    def _format_top_opportunities(self, opportunities: List[Dict[str, Any]]) -> str:
        """Format top opportunities for the prompt"""
        if not opportunities:
            return "No profitable opportunities found."
        
        formatted = []
        for i, opp in enumerate(opportunities[:3], 1):  # Top 3 only
            route = opp.get("route", {})
            profit = opp.get("profitability", {})
            formatted.append(
                f"{i}. {route.get('from_dex', 'N/A')} → {route.get('to_dex', 'N/A')}: "
                f"{profit.get('profit_margin_percent', 0):.2f}% profit, "
                f"{opp.get('recommendation', 'N/A')} ({opp.get('risk_level', 'N/A')} risk)"
            )
        
        return "\n".join(formatted)