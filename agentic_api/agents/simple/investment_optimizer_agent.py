"""Investment Optimizer Agent - Finds optimal APT investment amount for maximum profitability"""
from agents.simple.base import BaseAgent
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import asyncio
import time


class InvestmentOptimizerAgent(BaseAgent):
    """Agent that finds the optimal APT investment amount for maximum profit"""
    
    def __init__(self):
        super().__init__("InvestmentOptimizerAgent")
        
        # Investment ranges to test (in APT)
        self.apt_test_ranges = [
            # Small investments
            [1, 5, 10, 25, 50],
            # Medium investments  
            [100, 250, 500, 750, 1000],
            # Large investments
            [1500, 2000, 3000, 5000, 7500],
            # Very large investments
            [10000, 15000, 20000, 30000, 50000]
        ]
        
        # Current market prices (will be updated)
        self.current_prices = {
            "apt": 12.45,
            "usdc": 1.00,
            "usdt": 0.999
        }
        
        # DEX fee structures
        self.dex_fees = {
            "pancakeswap": 0.25,
            "liquidswap": 0.30,
            "thalaswap": 0.20,
            "hippo": 0.30
        }
        
        # Gas costs
        self.gas_costs = {
            "swap": 0.001,  # APT per swap
            "add_liquidity": 0.002,
            "remove_liquidity": 0.002
        }
    
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Find optimal APT investment amount"""
        try:
            action = input_data.get("action", "optimize_investment")
            
            # Update prices if provided
            if "current_prices" in input_data and input_data["current_prices"]:
                self._update_prices(input_data["current_prices"])
            
            # Accept apt_price directly from main_api (CRITICAL FIX)
            if "apt_price" in input_data:
                self.current_prices["apt"] = float(input_data["apt_price"])
                print(f"✅ Using live APT price: ${self.current_prices['apt']}")
            
            if action == "optimize_investment":
                return await self._optimize_investment_amount(input_data)
            elif action == "analyze_amount":
                return await self._analyze_specific_amount(input_data)
            elif action == "find_breakeven":
                return await self._find_breakeven_amount(input_data)
            else:
                return {"status": "error", "error": f"Unknown action: {action}"}
                
        except Exception as e:
            print(f"❌ Error in investment optimization: {e}")
            return {"status": "error", "error": str(e)}
    
    def _update_prices(self, prices: Dict[str, Any]):
        """Update current market prices"""
        for token, price in prices.items():
            if token.lower() in self.current_prices:
                self.current_prices[token.lower()] = float(price)
    
    async def _optimize_investment_amount(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Find the optimal APT investment amount for maximum profit"""
        try:
            from_token = input_data.get("from_token", "usdc")
            to_token = input_data.get("to_token", "usdt")
            custom_dex_fees = input_data.get("dex_fees", {})
            max_investment_apt = input_data.get("max_investment_apt", 50000)
            
            print(f"🔍 Optimizing investment for {from_token.upper()} → {to_token.upper()}")
            
            # Test different investment amounts
            optimization_results = []
            
            # Flatten test ranges and filter by max investment
            all_amounts = []
            for range_group in self.apt_test_ranges:
                all_amounts.extend([amt for amt in range_group if amt <= max_investment_apt])
            
            # Remove duplicates and sort
            test_amounts = sorted(list(set(all_amounts)))
            
            for apt_amount in test_amounts:
                # Convert APT to USD for trade amount
                trade_amount_usd = apt_amount * self.current_prices["apt"]
                
                # Calculate profitability for this amount
                profit_data = await self._calculate_profit_for_amount(
                    apt_amount, trade_amount_usd, from_token, to_token, custom_dex_fees
                )
                
                if profit_data["is_profitable"]:
                    optimization_results.append({
                        "apt_investment": apt_amount,
                        "usd_investment": trade_amount_usd,
                        "net_profit_usd": profit_data["net_profit_usd"],
                        "profit_margin_percent": profit_data["profit_margin_percent"],
                        "roi_percent": profit_data["roi_percent"],
                        "total_costs_usd": profit_data["total_costs_usd"],
                        "risk_level": profit_data["risk_level"]
                    })
            
            # Sort by profit margin (highest first)
            optimization_results.sort(key=lambda x: x["profit_margin_percent"], reverse=True)
            
            # Find optimal investment
            optimal_investment = None
            if optimization_results:
                # Find the investment with best risk-adjusted return
                optimal_investment = self._find_optimal_investment(optimization_results)
            
            result = {
                "status": "success",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "optimization": {
                    "from_token": from_token.upper(),
                    "to_token": to_token.upper(),
                    "max_investment_apt": max_investment_apt,
                    "amounts_tested": len(test_amounts),
                    "profitable_amounts": len(optimization_results)
                },
                "optimal_investment": optimal_investment,
                "all_profitable_options": optimization_results[:10],  # Top 10
                "market_conditions": {
                    "apt_price_usd": self.current_prices["apt"],
                    "price_spread_available": self._calculate_price_difference(from_token, to_token),
                    "gas_cost_apt": self.gas_costs["swap"] * 2,  # Two swaps
                    "gas_cost_usd": (self.gas_costs["swap"] * 2) * self.current_prices["apt"]
                },
                "recommendations": self._generate_investment_recommendations(optimization_results)
            }
            
            self.cache_result(result)
            return result
            
        except Exception as e:
            return {"status": "error", "error": f"Investment optimization failed: {str(e)}"}
    
    async def _calculate_profit_for_amount(self, apt_amount: float, trade_amount_usd: float, 
                                         from_token: str, to_token: str, custom_dex_fees: Dict) -> Dict[str, Any]:
        """Calculate profit for a specific investment amount"""
        
        # Calculate DEX fees
        from_dex_fee = custom_dex_fees.get("from_dex", self.dex_fees.get("pancakeswap", 0.25))
        to_dex_fee = custom_dex_fees.get("to_dex", self.dex_fees.get("liquidswap", 0.30))
        
        # Calculate trading fees
        from_fee_amount = trade_amount_usd * (from_dex_fee / 100)
        to_fee_amount = trade_amount_usd * (to_dex_fee / 100)
        total_trading_fees = from_fee_amount + to_fee_amount
        
        # Calculate gas costs
        total_gas_cost_apt = self.gas_costs["swap"] * 2  # Two swaps
        total_gas_cost_usd = total_gas_cost_apt * self.current_prices["apt"]
        
        # Calculate slippage (scales with amount)
        slippage_percent = self._estimate_slippage_for_amount(trade_amount_usd)
        slippage_cost = trade_amount_usd * (slippage_percent / 100)
        
        # Total costs
        total_costs = total_trading_fees + total_gas_cost_usd + slippage_cost
        
        # Calculate potential profit based on price difference
        price_difference = self._calculate_price_difference(from_token, to_token)
        gross_profit = trade_amount_usd * (price_difference / 100)
        
        # Net profit
        net_profit = gross_profit - total_costs
        is_profitable = net_profit > 0
        profit_margin = (net_profit / trade_amount_usd) * 100 if trade_amount_usd > 0 else 0
        
        # Risk assessment
        risk_level = self._assess_risk_level(profit_margin, trade_amount_usd)
        
        return {
            "is_profitable": is_profitable,
            "net_profit_usd": net_profit,
            "profit_margin_percent": profit_margin,
            "roi_percent": (net_profit / trade_amount_usd) * 100 if trade_amount_usd > 0 else 0,
            "total_costs_usd": total_costs,
            "risk_level": risk_level,
            "breakdown": {
                "gross_profit": gross_profit,
                "trading_fees": total_trading_fees,
                "gas_costs": total_gas_cost_usd,
                "slippage_costs": slippage_cost,
                "price_difference_percent": price_difference
            }
        }
    
    def _find_optimal_investment(self, results: List[Dict]) -> Optional[Dict]:
        """Find the optimal investment considering risk and return"""
        if not results:
            return None
        
        # Score each investment based on profit margin and risk
        scored_results = []
        
        for result in results:
            profit_margin = result["profit_margin_percent"]
            risk_level = result["risk_level"]
            
            # Risk scoring (lower is better)
            risk_scores = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "VERY_HIGH": 4}
            risk_score = risk_scores.get(risk_level, 4)
            
            # Combined score (higher is better)
            # Favor higher profit margins with lower risk
            combined_score = profit_margin / risk_score
            
            scored_results.append({
                **result,
                "combined_score": combined_score
            })
        
        # Sort by combined score
        scored_results.sort(key=lambda x: x["combined_score"], reverse=True)
        
        optimal = scored_results[0]
        
        return {
            "recommended_apt_investment": optimal["apt_investment"],
            "recommended_usd_investment": optimal["usd_investment"],
            "expected_profit_usd": optimal["net_profit_usd"],
            "expected_profit_margin": optimal["profit_margin_percent"],
            "expected_roi": optimal["roi_percent"],
            "risk_level": optimal["risk_level"],
            "total_costs": optimal["total_costs_usd"],
            "combined_score": optimal["combined_score"],
            "reasoning": self._generate_reasoning(optimal)
        }
    
    def _generate_reasoning(self, optimal: Dict) -> str:
        """Generate reasoning for the optimal investment choice"""
        apt_amount = optimal["apt_investment"]
        profit_margin = optimal["profit_margin_percent"]
        risk_level = optimal["risk_level"]
        
        if apt_amount < 100:
            size_desc = "small"
        elif apt_amount < 1000:
            size_desc = "medium"
        elif apt_amount < 5000:
            size_desc = "large"
        else:
            size_desc = "very large"
        
        return f"Optimal {size_desc} investment of {apt_amount} APT provides {profit_margin:.3f}% profit margin with {risk_level.lower()} risk. This balance maximizes returns while managing exposure."
    
    def _calculate_price_difference(self, from_token: str, to_token: str) -> float:
        """Calculate price difference between tokens (realistic arbitrage opportunity)"""
        # Simulate realistic price differences between DEXs
        if from_token == "usdc" and to_token == "usdt":
            return 1.2  # 1.2% spread between stablecoins
        elif from_token == "usdt" and to_token == "usdc":
            return 1.1  # 1.1% spread
        elif "apt" in [from_token, to_token]:
            return 0.9  # 0.9% spread involving APT
        else:
            return 0.7  # 0.7% for other pairs
    
    def _estimate_slippage_for_amount(self, trade_amount_usd: float) -> float:
        """Estimate slippage based on trade amount"""
        if trade_amount_usd < 1000:
            return 0.02  # 0.02%
        elif trade_amount_usd < 5000:
            return 0.05  # 0.05%
        elif trade_amount_usd < 25000:
            return 0.15  # 0.15%
        elif trade_amount_usd < 100000:
            return 0.35  # 0.35%
        else:
            return 0.75  # 0.75% for very large trades
    
    def _assess_risk_level(self, profit_margin: float, trade_amount_usd: float) -> str:
        """Assess risk level based on profit margin and trade size"""
        if profit_margin > 1.0 and trade_amount_usd < 10000:
            return "LOW"
        elif profit_margin > 0.5 and trade_amount_usd < 50000:
            return "MEDIUM"
        elif profit_margin > 0.2:
            return "HIGH"
        else:
            return "VERY_HIGH"
    
    def _generate_investment_recommendations(self, results: List[Dict]) -> List[str]:
        """Generate investment recommendations based on results"""
        recommendations = []
        
        if not results:
            recommendations.append("No profitable opportunities found with current market conditions")
            recommendations.append("Consider waiting for better price spreads or lower gas fees")
            return recommendations
        
        # Analyze results
        total_profitable = len(results)
        avg_margin = sum(r["profit_margin_percent"] for r in results) / total_profitable
        best_margin = max(r["profit_margin_percent"] for r in results)
        
        recommendations.append(f"Found {total_profitable} profitable investment amounts")
        recommendations.append(f"Average profit margin: {avg_margin:.3f}%")
        recommendations.append(f"Best profit margin: {best_margin:.3f}%")
        
        # Risk-based recommendations
        low_risk_count = len([r for r in results if r["risk_level"] == "LOW"])
        if low_risk_count > 0:
            recommendations.append(f"{low_risk_count} low-risk opportunities available")
        
        # Size-based recommendations
        small_investments = [r for r in results if r["apt_investment"] < 100]
        large_investments = [r for r in results if r["apt_investment"] > 1000]
        
        if small_investments:
            best_small = max(small_investments, key=lambda x: x["profit_margin_percent"])
            recommendations.append(f"Best small investment: {best_small['apt_investment']} APT ({best_small['profit_margin_percent']:.3f}% margin)")
        
        if large_investments:
            best_large = max(large_investments, key=lambda x: x["profit_margin_percent"])
            recommendations.append(f"Best large investment: {best_large['apt_investment']} APT ({best_large['profit_margin_percent']:.3f}% margin)")
        
        return recommendations
    
    async def _analyze_specific_amount(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a specific APT investment amount"""
        try:
            apt_amount = input_data.get("apt_amount", 1000)
            from_token = input_data.get("from_token", "usdc")
            to_token = input_data.get("to_token", "usdt")
            custom_dex_fees = input_data.get("dex_fees", {})
            
            trade_amount_usd = apt_amount * self.current_prices["apt"]
            
            profit_data = await self._calculate_profit_for_amount(
                apt_amount, trade_amount_usd, from_token, to_token, custom_dex_fees
            )
            
            result = {
                "status": "success",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "analysis": {
                    "apt_investment": apt_amount,
                    "usd_investment": trade_amount_usd,
                    "is_profitable": profit_data["is_profitable"],
                    "net_profit_usd": profit_data["net_profit_usd"],
                    "profit_margin_percent": profit_data["profit_margin_percent"],
                    "roi_percent": profit_data["roi_percent"],
                    "risk_level": profit_data["risk_level"],
                    "total_costs_usd": profit_data["total_costs_usd"]
                },
                "cost_breakdown": profit_data["breakdown"],
                "recommendation": "EXECUTE" if profit_data["is_profitable"] and profit_data["profit_margin_percent"] > 0.5 else "SKIP"
            }
            
            return result
            
        except Exception as e:
            return {"status": "error", "error": f"Amount analysis failed: {str(e)}"}
    
    async def _find_breakeven_amount(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Find the minimum APT amount needed to break even"""
        try:
            from_token = input_data.get("from_token", "usdc")
            to_token = input_data.get("to_token", "usdt")
            custom_dex_fees = input_data.get("dex_fees", {})
            
            # Binary search for breakeven point
            min_apt = 1
            max_apt = 100000
            breakeven_apt = None
            
            for _ in range(20):  # Max 20 iterations
                mid_apt = (min_apt + max_apt) / 2
                trade_amount_usd = mid_apt * self.current_prices["apt"]
                
                profit_data = await self._calculate_profit_for_amount(
                    mid_apt, trade_amount_usd, from_token, to_token, custom_dex_fees
                )
                
                if abs(profit_data["net_profit_usd"]) < 0.01:  # Close to breakeven
                    breakeven_apt = mid_apt
                    break
                elif profit_data["net_profit_usd"] < 0:
                    min_apt = mid_apt
                else:
                    max_apt = mid_apt
            
            result = {
                "status": "success",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "breakeven_analysis": {
                    "breakeven_apt_amount": breakeven_apt,
                    "breakeven_usd_amount": breakeven_apt * self.current_prices["apt"] if breakeven_apt else None,
                    "found": breakeven_apt is not None
                },
                "market_conditions": {
                    "price_spread_percent": self._calculate_price_difference(from_token, to_token),
                    "minimum_spread_needed": 0.6  # Approximate minimum needed to overcome fees
                }
            }
            
            return result
            
        except Exception as e:
            return {"status": "error", "error": f"Breakeven analysis failed: {str(e)}"}