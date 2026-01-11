"""
Calculation Tools for Arbitrage Analysis using LangChain
"""
from typing import Dict, Any, Optional, List, Type
from langchain.tools import BaseTool
from pydantic import BaseModel, Field
import json


class PriceCalculationInput(BaseModel):
    """Input for price calculation tool"""
    token_prices: Dict[str, float] = Field(description="Token prices mapping")
    from_token: str = Field(description="Source token")
    to_token: str = Field(description="Destination token")
    trade_amount: float = Field(description="Trade amount in USD")


class GasCalculationInput(BaseModel):
    """Input for gas calculation tool"""
    gas_unit_price: int = Field(description="Gas unit price in octas")
    operations: int = Field(description="Number of operations")
    apt_price: float = Field(description="APT price in USD")
    token_type: str = Field(description="Token type (apt, usdc, usdt)")


class FeeCalculationInput(BaseModel):
    """Input for fee calculation tool"""
    trade_amount: float = Field(description="Trade amount in USD")
    dex_fees: Dict[str, float] = Field(description="DEX fees mapping")
    from_dex: str = Field(description="Source DEX")
    to_dex: str = Field(description="Destination DEX")


class SlippageCalculationInput(BaseModel):
    """Input for slippage calculation tool"""
    trade_amount: float = Field(description="Trade amount in USD")
    liquidity_depth: Optional[float] = Field(default=None, description="Liquidity depth")
    market_volatility: Optional[float] = Field(default=None, description="Market volatility")


class ProfitabilityAnalysisInput(BaseModel):
    """Input for profitability analysis tool"""
    gross_profit: float = Field(description="Gross profit in USD")
    total_costs: float = Field(description="Total costs in USD")
    trade_amount: float = Field(description="Trade amount in USD")
    risk_factors: Dict[str, Any] = Field(description="Risk factors")


class PriceCalculationTool(BaseTool):
    """Tool for calculating price differences and potential profits"""
    name: str = "price_calculation"
    description: str = "Calculate price differences and potential profits between trading pairs"
    args_schema: Type[BaseModel] = PriceCalculationInput

    def _run(self, token_prices: Dict[str, float], from_token: str, to_token: str, trade_amount: float) -> str:
        """Calculate price differences and potential profits"""
        try:
            from_price = token_prices.get(from_token.lower(), 1.0)
            to_price = token_prices.get(to_token.lower(), 1.0)
            
            # Calculate price difference percentage
            if from_token.lower() == "apt" and to_token.lower() in ["usdc", "usdt"]:
                # APT -> Stablecoin: Look for APT being undervalued
                price_diff_percent = self._calculate_apt_to_stable_diff(from_price, to_price)
            elif from_token.lower() in ["usdc", "usdt"] and to_token.lower() == "apt":
                # Stablecoin -> APT: Look for APT being overvalued
                price_diff_percent = self._calculate_stable_to_apt_diff(from_price, to_price)
            else:
                # Stablecoin to stablecoin
                price_diff_percent = abs(from_price - to_price) / from_price * 100
            
            gross_profit = trade_amount * (price_diff_percent / 100)
            
            result = {
                "price_difference_percent": round(price_diff_percent, 4),
                "gross_profit_usd": round(gross_profit, 4),
                "from_price": from_price,
                "to_price": to_price,
                "calculation_method": f"{from_token.upper()} -> {to_token.upper()}"
            }
            
            return json.dumps(result)
            
        except Exception as e:
            return json.dumps({"error": f"Price calculation failed: {str(e)}"})
    
    def _calculate_apt_to_stable_diff(self, apt_price: float, stable_price: float) -> float:
        """Calculate price difference for APT to stablecoin trades"""
        # Simulate realistic DEX price variations (0.5-2% differences)
        # In real scenarios, different DEXs have slightly different prices
        base_diff = 1.2  # 1.2% base difference
        volatility_factor = min(apt_price / 10, 0.5)  # Higher APT price = more volatility
        return base_diff + volatility_factor
    
    def _calculate_stable_to_apt_diff(self, stable_price: float, apt_price: float) -> float:
        """Calculate price difference for stablecoin to APT trades"""
        base_diff = 1.1  # 1.1% base difference
        volatility_factor = min(apt_price / 15, 0.3)
        return base_diff + volatility_factor


class GasCalculationTool(BaseTool):
    """Tool for calculating gas costs"""
    name: str = "gas_calculation"
    description: str = "Calculate gas costs for different token operations"
    args_schema: Type[BaseModel] = GasCalculationInput

    def _run(self, gas_unit_price: int, operations: int, apt_price: float, token_type: str) -> str:
        """Calculate gas costs"""
        try:
            # Gas units vary by token complexity
            gas_units_map = {
                "apt": 500,    # Native token operations
                "usdc": 800,   # ERC20-like token operations
                "usdt": 800,   # ERC20-like token operations
            }
            
            gas_units_per_op = gas_units_map.get(token_type.lower(), 600)
            total_gas_units = gas_units_per_op * operations
            
            # Calculate costs
            total_cost_octas = total_gas_units * gas_unit_price
            total_cost_apt = total_cost_octas / 100_000_000  # 1 APT = 100M octas
            total_cost_usd = total_cost_apt * apt_price
            
            result = {
                "gas_unit_price_octas": gas_unit_price,
                "gas_units_per_operation": gas_units_per_op,
                "total_operations": operations,
                "total_gas_units": total_gas_units,
                "total_cost_apt": round(total_cost_apt, 6),
                "total_cost_usd": round(total_cost_usd, 4),
                "apt_price_used": apt_price
            }
            
            return json.dumps(result)
            
        except Exception as e:
            return json.dumps({"error": f"Gas calculation failed: {str(e)}"})


class FeeCalculationTool(BaseTool):
    """Tool for calculating DEX fees"""
    name: str = "fee_calculation"
    description: str = "Calculate DEX trading fees"
    args_schema: Type[BaseModel] = FeeCalculationInput

    def _run(self, trade_amount: float, dex_fees: Dict[str, float], from_dex: str, to_dex: str) -> str:
        """Calculate DEX fees"""
        try:
            # Default DEX fees if not provided
            default_fees = {
                "pancakeswap": 0.25,
                "liquidswap": 0.30,
                "thalaswap": 0.20,
                "hippo": 0.30
            }
            
            # Get fees with intelligent fallback
            from_fee_percent = self._get_fee_rate(dex_fees, from_dex, default_fees)
            to_fee_percent = self._get_fee_rate(dex_fees, to_dex, default_fees)
            
            from_fee_amount = trade_amount * (from_fee_percent / 100)
            to_fee_amount = trade_amount * (to_fee_percent / 100)
            total_fees = from_fee_amount + to_fee_amount
            
            result = {
                "from_dex": from_dex,
                "to_dex": to_dex,
                "from_fee_percent": from_fee_percent,
                "to_fee_percent": to_fee_percent,
                "from_fee_amount_usd": round(from_fee_amount, 4),
                "to_fee_amount_usd": round(to_fee_amount, 4),
                "total_fees_usd": round(total_fees, 4),
                "fees_applied": from_fee_percent > 0 or to_fee_percent > 0
            }
            
            return json.dumps(result)
            
        except Exception as e:
            return json.dumps({"error": f"Fee calculation failed: {str(e)}"})
    
    def _get_fee_rate(self, custom_fees: Dict[str, float], dex_name: str, defaults: Dict[str, float]) -> float:
        """Get fee rate with intelligent fallback"""
        if not custom_fees:
            return 0.0  # No fees if not specified
        
        # Try multiple keys in order of preference
        possible_keys = [
            dex_name,  # Exact DEX name
            "Smart Contract",  # Generic name
            "default",  # Default key
            "fee",  # Generic fee key
            "from_dex" if "from" in dex_name else "to_dex",  # Direction-based
        ]
        
        for key in possible_keys:
            if key in custom_fees:
                return custom_fees[key]
        
        # If only one fee provided, use it for both
        if len(custom_fees) == 1:
            return list(custom_fees.values())[0]
        
        # Fallback to default
        return defaults.get(dex_name, 0.25)


class SlippageCalculationTool(BaseTool):
    """Tool for calculating slippage"""
    name: str = "slippage_calculation"
    description: str = "Calculate estimated slippage based on trade size and market conditions"
    args_schema: Type[BaseModel] = SlippageCalculationInput

    def _run(self, trade_amount: float, liquidity_depth: Optional[float] = None, market_volatility: Optional[float] = None) -> str:
        """Calculate slippage"""
        try:
            # Base slippage calculation based on trade amount
            if trade_amount < 100:
                base_slippage = 0.01  # 0.01% for very small trades
            elif trade_amount < 1000:
                base_slippage = 0.02  # 0.02% for small trades
            elif trade_amount < 5000:
                base_slippage = 0.05  # 0.05% for medium trades
            elif trade_amount < 20000:
                base_slippage = 0.15  # 0.15% for large trades
            else:
                base_slippage = 0.30  # 0.30% for very large trades
            
            # Adjust for liquidity depth
            liquidity_factor = 1.0
            if liquidity_depth:
                if trade_amount / liquidity_depth > 0.1:  # >10% of liquidity
                    liquidity_factor = 1.5
                elif trade_amount / liquidity_depth > 0.05:  # >5% of liquidity
                    liquidity_factor = 1.2
            
            # Adjust for market volatility
            volatility_factor = 1.0
            if market_volatility:
                volatility_factor = 1 + (market_volatility / 100)
            
            final_slippage = base_slippage * liquidity_factor * volatility_factor
            slippage_cost = trade_amount * (final_slippage / 100)
            
            result = {
                "base_slippage_percent": base_slippage,
                "liquidity_factor": liquidity_factor,
                "volatility_factor": volatility_factor,
                "final_slippage_percent": round(final_slippage, 4),
                "slippage_cost_usd": round(slippage_cost, 4),
                "trade_amount": trade_amount
            }
            
            return json.dumps(result)
            
        except Exception as e:
            return json.dumps({"error": f"Slippage calculation failed: {str(e)}"})


class ProfitabilityAnalysisTool(BaseTool):
    """Tool for analyzing profitability and risk"""
    name: str = "profitability_analysis"
    description: str = "Analyze profitability and assess risk levels"
    args_schema: Type[BaseModel] = ProfitabilityAnalysisInput

    def _run(self, gross_profit: float, total_costs: float, trade_amount: float, risk_factors: Dict[str, Any]) -> str:
        """Analyze profitability"""
        try:
            net_profit = gross_profit - total_costs
            is_profitable = net_profit > 0
            profit_margin_percent = (net_profit / trade_amount) * 100 if trade_amount > 0 else 0
            roi_percent = profit_margin_percent
            
            # Risk assessment
            risk_level = self._assess_risk(profit_margin_percent, trade_amount, risk_factors)
            recommendation = self._get_recommendation(is_profitable, profit_margin_percent, risk_level)
            
            result = {
                "is_profitable": is_profitable,
                "gross_profit_usd": round(gross_profit, 4),
                "total_costs_usd": round(total_costs, 4),
                "net_profit_usd": round(net_profit, 4),
                "profit_margin_percent": round(profit_margin_percent, 4),
                "roi_percent": round(roi_percent, 4),
                "risk_level": risk_level,
                "recommendation": recommendation,
                "cost_percentage": round((total_costs / trade_amount) * 100, 4) if trade_amount > 0 else 0
            }
            
            return json.dumps(result)
            
        except Exception as e:
            return json.dumps({"error": f"Profitability analysis failed: {str(e)}"})
    
    def _assess_risk(self, profit_margin: float, trade_amount: float, risk_factors: Dict[str, Any]) -> str:
        """Assess risk level"""
        if profit_margin > 2.0 and trade_amount < 5000:
            return "LOW"
        elif profit_margin > 1.0 and trade_amount < 20000:
            return "MEDIUM"
        elif profit_margin > 0.5:
            return "HIGH"
        else:
            return "VERY_HIGH"
    
    def _get_recommendation(self, is_profitable: bool, profit_margin: float, risk_level: str) -> str:
        """Get trading recommendation"""
        if not is_profitable:
            return "SKIP"
        elif profit_margin > 1.0 and risk_level in ["LOW", "MEDIUM"]:
            return "EXECUTE"
        elif profit_margin > 0.5:
            return "CONSIDER"
        else:
            return "SKIP"