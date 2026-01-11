"""Optimized FastAPI for Aptos Arbitrage System - Live Data First with 5s Timeout"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncio
import time
import os

from agents.simple.market_data_agent import MarketDataAgent
from agents.simple.arbitrage_detector_agent import ArbitrageDetectorAgent
from agents.simple.investment_optimizer_agent import InvestmentOptimizerAgent

# Try to import enhanced agent, fall back gracefully
try:
    from agents.enhanced.langchain_arbitrage_agent import LangChainArbitrageAgent
    ENHANCED_AGENT_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Enhanced LangChain agent not available: {e}")
    ENHANCED_AGENT_AVAILABLE = False
    LangChainArbitrageAgent = None

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    print("🚀 Starting Aptos Arbitrage API v7.0.0...")
    print("📊 Behavior: Always fetch live data first (5000ms timeout)")
    print("🔄 Fetching initial market data...")
    
    try:
        await state.fetch_live_market_data()
        print("✅ Initial market data loaded")
    except Exception as e:
        print(f"⚠️ Initial fetch failed, using fallback: {e}")
    
    yield
    
    # Shutdown (if needed)
    print("🛑 Shutting down Aptos Arbitrage API...")


# ============== FastAPI App ==============
app = FastAPI(
    title="Aptos Arbitrage API",
    description="Aptos token arbitrage system - Always fetches live data with 5s timeout fallback",
    version="7.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== Global State (No Cache Duration) ==============
class GlobalState:
    """Global state - stores last successful data, always tries live first"""
    
    def __init__(self):
        # Stored values (updated on successful fetch)
        self.stored_market_data: Dict[str, Any] = {}
        self.last_successful_fetch: float = 0
        self.timeout_ms: int = 5000  # 5000ms = 5 seconds
        
        # Initialize agents
        self.market_agent = MarketDataAgent()
        self.arbitrage_agent = ArbitrageDetectorAgent()
        self.optimizer_agent = InvestmentOptimizerAgent()
        
        # Initialize enhanced agent if available
        self.langchain_agent = None
        self.use_langchain = False
        
        if ENHANCED_AGENT_AVAILABLE and os.getenv("OPENAI_API_KEY"):
            try:
                self.langchain_agent = LangChainArbitrageAgent(openai_api_key=os.getenv("OPENAI_API_KEY"))
                self.use_langchain = True
                print("✅ Enhanced LangChain agent initialized")
            except Exception as e:
                print(f"⚠️ Failed to initialize LangChain agent: {e}")
                self.use_langchain = False
        else:
            print("⚠️ Using simple rule-based agents (LangChain not available or no OpenAI key)")
        
        # Initialize with fallback data
        self._initialize_stored_data()
    
    def _initialize_stored_data(self):
        """Initialize stored data with fallback values"""
        self.stored_market_data = {
            "status": "success",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "base_currency": "usd",
            "chains": [
                {
                    "chain": "apt",
                    "current_price": "12.45",
                    "gas_fees": "0.001",
                    "tvl_usd": "850,000,000",
                    "market_cap": "$5,200,000,000",
                    "fully_diluted_valuation": "$5,200,000,000",
                    "volume_24h": "$180,000,000"
                },
                {
                    "chain": "usdc",
                    "current_price": "1.00",
                    "gas_fees": "0.001",
                    "tvl_usd": "850,000,000",
                    "market_cap": "$25,000,000,000",
                    "fully_diluted_valuation": "$25,000,000,000",
                    "volume_24h": "$2,800,000,000"
                },
                {
                    "chain": "usdt",
                    "current_price": "0.999",
                    "gas_fees": "0.001",
                    "tvl_usd": "850,000,000",
                    "market_cap": "$95,000,000,000",
                    "fully_diluted_valuation": "$95,000,000,000",
                    "volume_24h": "$15,000,000,000"
                }
            ],
            "data_source": "initial_fallback"
        }
    
    async def fetch_live_market_data(self) -> Dict[str, Any]:
        """
        Always try to fetch live data first (up to 5000ms).
        If timeout, return previously stored value.
        If success, update stored value and return.
        """
        start_time = time.time()
        
        try:
            # Try to fetch live data with 5000ms timeout
            result = await asyncio.wait_for(
                self.market_agent.execute(),
                timeout=self.timeout_ms / 1000  # Convert to seconds
            )
            
            elapsed_ms = (time.time() - start_time) * 1000
            
            if result.get("status") == "success":
                # Update stored data on success
                self.stored_market_data = result
                self.last_successful_fetch = time.time()
                
                sources = result.get("data_sources", {})
                print(f"✅ Live data fetched in {elapsed_ms:.0f}ms - Price: {sources.get('price_source')}, Gas: {sources.get('gas_source')}, DeFi: {sources.get('defi_source')}")
                
                return result
            else:
                # Fetch failed, return stored data
                print(f"⚠️ Live fetch failed after {elapsed_ms:.0f}ms, returning stored data")
                return self._get_stored_with_note("Live fetch failed, using stored data")
                
        except asyncio.TimeoutError:
            elapsed_ms = (time.time() - start_time) * 1000
            print(f"⏱️ Timeout after {elapsed_ms:.0f}ms (limit: {self.timeout_ms}ms), returning stored data")
            return self._get_stored_with_note(f"Timeout after {elapsed_ms:.0f}ms, using stored data")
            
        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            print(f"❌ Error after {elapsed_ms:.0f}ms: {e}, returning stored data")
            return self._get_stored_with_note(f"Error: {str(e)}, using stored data")
    
    def _get_stored_with_note(self, note: str) -> Dict[str, Any]:
        """Return stored data with a note about why"""
        result = self.stored_market_data.copy()
        result["timestamp"] = datetime.utcnow().isoformat() + "Z"
        result["data_source"] = "stored_fallback"
        result["note"] = note
        result["last_successful_fetch_seconds_ago"] = round(time.time() - self.last_successful_fetch, 1) if self.last_successful_fetch > 0 else None
        return result
    
    def get_stored_data(self) -> Dict[str, Any]:
        """Get currently stored market data"""
        return self.stored_market_data


# Global state instance
state = GlobalState()


# ============== Request Models ==============
class ArbitrageChargesRequest(BaseModel):
    from_token: str = Field(..., description="Source token (usdc, apt, usdt)")
    to_token: str = Field(..., description="Destination token (usdc, apt, usdt)")
    amount_apt: Optional[float] = Field(default=None, description="Investment amount in APT")
    amount_usd: Optional[float] = Field(default=None, description="Investment amount in USD")
    trade_amount: Optional[float] = Field(default=None, description="Direct trade amount in USD (alias for amount_usd)")
    dex_fees: Optional[Dict[str, float]] = Field(default=None, description="Custom DEX fees (if not provided, fees = 0)")
    current_prices: Optional[List[Dict[str, str]]] = Field(default=None, description="Custom prices")
    apt_price: Optional[str] = Field(default=None, description="Direct APT price override")


class ArbitrageProfitableRequest(BaseModel):
    from_token: str = Field(..., description="Source token (usdc, apt, usdt)")
    to_token: Optional[str] = Field(default=None, description="Destination token (if not provided, check both USDC and USDT)")
    amount_apt: Optional[float] = Field(default=None, description="Investment amount in APT")
    amount_usd: Optional[float] = Field(default=None, description="Investment amount in USD")
    trade_amount: Optional[float] = Field(default=None, description="Direct trade amount in USD (alias for amount_usd)")
    dex_fees: Optional[Dict[str, float]] = Field(default=None, description="Custom DEX fees (if not provided, fees = 0)")
    current_prices: Optional[List[Dict[str, str]]] = Field(default=None, description="Custom prices")
    apt_price: Optional[str] = Field(default=None, description="Direct APT price override")


class ArbitragePossibilitiesRequest(BaseModel):
    amount_apt: Optional[float] = Field(default=None, description="Investment amount in APT")
    amount_usd: Optional[float] = Field(default=None, description="Investment amount in USD")
    trade_amount: Optional[float] = Field(default=None, description="Direct trade amount in USD (alias for amount_usd)")
    dex_fees: Optional[Dict[str, float]] = Field(default=None, description="Custom DEX fees (if not provided, fees = 0)")
    current_prices: Optional[List[Dict[str, str]]] = Field(default=None, description="Custom prices")
    apt_price: Optional[str] = Field(default=None, description="Direct APT price override")


class InvestmentOptimizationRequest(BaseModel):
    from_token: str = Field(..., description="Source token (usdc, apt, usdt)")
    to_token: str = Field(..., description="Destination token (usdc, apt, usdt)")
    max_investment_apt: Optional[float] = Field(default=50000, description="Maximum APT investment to consider")
    dex_fees: Optional[Dict[str, float]] = Field(default=None, description="Custom DEX fees")
    current_prices: Optional[List[Dict[str, str]]] = Field(default=None, description="Custom prices")
    apt_price: Optional[str] = Field(default=None, description="Direct APT price override")


# ============== Helper Functions ==============
async def execute_with_timeout(coro, timeout_ms: int, fallback: Dict[str, Any]) -> Dict[str, Any]:
    """Execute coroutine with timeout, return fallback if exceeded"""
    try:
        return await asyncio.wait_for(coro, timeout=timeout_ms / 1000)
    except asyncio.TimeoutError:
        print(f"⏱️ Request timed out after {timeout_ms}ms, returning fallback")
        fallback["timeout"] = True
        fallback["timeout_ms"] = timeout_ms
        return fallback
    except Exception as e:
        print(f"❌ Error: {e}, returning fallback")
        fallback["error"] = str(e)
        return fallback


def parse_custom_prices(current_prices: Optional[List[Dict[str, str]]]) -> Optional[Dict[str, float]]:
    """Parse custom prices from request format"""
    if not current_prices:
        return None
    
    parsed_prices = {}
    for price_dict in current_prices:
        for token, price in price_dict.items():
            try:
                parsed_prices[token.lower()] = float(price)
            except (ValueError, TypeError):
                continue
    
    return parsed_prices if parsed_prices else None


def get_trade_amount(
    amount_apt: Optional[float],
    amount_usd: Optional[float],
    apt_price: float,
    trade_amount: Optional[float] = None
) -> float:
    """Get trade amount in USD, prioritizing: trade_amount > amount_apt > amount_usd > default"""
    if trade_amount is not None:
        return trade_amount
    elif amount_apt is not None:
        return amount_apt * apt_price
    elif amount_usd is not None:
        return amount_usd
    else:
        return 1000.0


def get_current_apt_price(market_data: Dict[str, Any]) -> float:
    """Extract current APT price from market data"""
    try:
        for chain in market_data.get("chains", []):
            if chain.get("chain") == "apt":
                return float(chain.get("current_price", 12.45))
    except:
        pass
    return 12.45


def get_effective_apt_price(market_data: Dict[str, Any], custom_apt_price: Optional[str] = None) -> float:
    """Get APT price, prioritizing custom price over live data"""
    if custom_apt_price:
        try:
            return float(custom_apt_price)
        except (ValueError, TypeError):
            pass
    return get_current_apt_price(market_data)


# ============== API Routes ==============
@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "Aptos Arbitrage API",
        "version": "7.0.0",
        "ecosystem": "aptos",
        "supported_tokens": ["APT", "USDC", "USDT"],
        "endpoints": [
            "GET /market/overview",
            "POST /arbitrage/getcharges",
            "POST /arbitrage/isprofitable", 
            "POST /arbitrage/possibilities",
            "POST /arbitrage/optimize-investment"
        ],
        "behavior": "Always fetches live data first (up to 5000ms), returns stored value on timeout",
        "ai_agent": "LangChain-powered" if state.use_langchain else "Simple rule-based",
        "langchain_enabled": state.use_langchain
    }


@app.get("/market/overview")
async def get_market_overview():
    """
    Get Aptos market overview for APT, USDC, USDT
    
    Behavior:
    - Always tries to fetch live data first
    - Waits up to 5000ms for live data
    - If timeout/error, returns previously stored value
    - On success, updates stored value
    """
    return await state.fetch_live_market_data()


@app.post("/arbitrage/getcharges")
async def get_arbitrage_charges(request: ArbitrageChargesRequest):
    """
    Calculate all charges for Aptos token arbitrage
    Tries live data first, falls back to stored on timeout
    """
    try:
        # First get live market data
        market_data = await state.fetch_live_market_data()
        apt_price = get_effective_apt_price(market_data, request.apt_price)
        
        # Determine trade amount (supports trade_amount, amount_apt, or amount_usd)
        trade_amount = get_trade_amount(request.amount_apt, request.amount_usd, apt_price, request.trade_amount)
        
        # Parse custom prices
        custom_prices = parse_custom_prices(request.current_prices)
        
        # Handle DEX fees (0 if not provided)
        dex_fees = request.dex_fees or {}
        
        input_data = {
            "action": "getcharges",
            "from_pair": f"{request.from_token}_apt" if request.to_token == "apt" else f"apt_{request.to_token}",
            "to_pair": f"{request.to_token}_apt" if request.from_token == "apt" else f"apt_{request.from_token}",
            "trade_amount": trade_amount,
            "current_prices": custom_prices,
            "custom_dex_fees": dex_fees,
            "apt_price": apt_price  # Pass consistent APT price to agent
        }
        
        # Execute with timeout using the appropriate agent
        if state.use_langchain and state.langchain_agent:
            print("🤖 Using LangChain-powered arbitrage analysis")
            result = await execute_with_timeout(
                state.langchain_agent.execute(input_data),
                timeout_ms=state.timeout_ms * 2,  # Give LangChain more time
                fallback=state.arbitrage_agent.get_cached_result() or {"status": "timeout", "message": "Request timed out"}
            )
        else:
            print("⚡ Using simple arbitrage analysis")
            result = await execute_with_timeout(
                state.arbitrage_agent.execute(input_data),
                timeout_ms=state.timeout_ms,
                fallback=state.arbitrage_agent.get_cached_result() or {"status": "timeout", "message": "Request timed out"}
            )
        
        if result.get("status") == "success":
            result["investment_details"] = {
                "amount_apt": request.amount_apt,
                "amount_usd": trade_amount,
                "apt_price_used": apt_price,
                "dex_fees_applied": len(dex_fees) > 0
            }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Charge calculation failed: {str(e)}")


@app.post("/arbitrage/isprofitable")
async def is_arbitrage_profitable(request: ArbitrageProfitableRequest):
    """
    Detect if Aptos token arbitrage is profitable
    If to_token not provided, checks both USDC and USDT
    """
    try:
        # First get live market data
        market_data = await state.fetch_live_market_data()
        apt_price = get_effective_apt_price(market_data, request.apt_price)
        
        trade_amount = get_trade_amount(request.amount_apt, request.amount_usd, apt_price, request.trade_amount)
        custom_prices = parse_custom_prices(request.current_prices)
        dex_fees = request.dex_fees or {}
        
        # If no to_token, check both USDC and USDT
        tokens_to_check = [request.to_token] if request.to_token else [t for t in ["usdc", "usdt", "apt"] if t != request.from_token]
        
        results = []
        for to_token in tokens_to_check:
            # Construct pairs correctly based on from_token and to_token
            if request.from_token == "apt":
                # APT is the starting token
                from_pair = f"apt_{to_token}"
                to_pair = f"{to_token}_apt"
            elif to_token == "apt":
                # APT is the destination token
                from_pair = f"{request.from_token}_apt"
                to_pair = f"apt_{request.from_token}"
            else:
                # Both are non-APT tokens, route through APT
                from_pair = f"{request.from_token}_apt"
                to_pair = f"apt_{to_token}"
            
            input_data = {
                "action": "isprofitable",
                "from_pair": from_pair,
                "to_pair": to_pair,
                "trade_amount": trade_amount,
                "current_prices": custom_prices,
                "custom_dex_fees": dex_fees,
                "apt_price": apt_price  # Pass consistent APT price to agent
            }
            
            # Execute with timeout using the appropriate agent
            if state.use_langchain and state.langchain_agent:
                print("🤖 Using LangChain-powered profitability analysis")
                result = await execute_with_timeout(
                    state.langchain_agent.execute(input_data),
                    timeout_ms=state.timeout_ms * 2,  # Give LangChain more time
                    fallback={"status": "timeout", "is_profitable": False}
                )
            else:
                print("⚡ Using simple profitability analysis")
                result = await execute_with_timeout(
                    state.arbitrage_agent.execute(input_data),
                    timeout_ms=state.timeout_ms,
                    fallback={"status": "timeout", "is_profitable": False}
                )
            
            if result.get("status") == "success":
                result["to_token"] = to_token.upper()
                result["investment_details"] = {"amount_apt": request.amount_apt, "amount_usd": trade_amount, "apt_price_used": apt_price}
                results.append(result)
        
        if len(results) == 1:
            return results[0]
        
        # Find best profitable option
        profitable = [r for r in results if r.get("profitability", {}).get("is_profitable", False)]
        if profitable:
            best = max(profitable, key=lambda x: x.get("profitability", {}).get("profit_margin_percent", 0))
            best["alternatives_checked"] = len(results)
            best["other_options"] = [{"to_token": r["to_token"], "is_profitable": r.get("profitability", {}).get("is_profitable", False), "profit_margin": r.get("profitability", {}).get("profit_margin_percent", 0)} for r in results if r != best]
            return best
        
        return {"status": "success", "profitability": {"is_profitable": False}, "alternatives_checked": len(results), "all_options": [{"to_token": r.get("to_token"), "profit_margin": r.get("profitability", {}).get("profit_margin_percent", 0)} for r in results], "recommendation": "SKIP"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profitability check failed: {str(e)}")


@app.post("/arbitrage/possibilities")
async def find_arbitrage_possibilities(request: ArbitragePossibilitiesRequest):
    """Find all Aptos arbitrage possibilities"""
    try:
        market_data = await state.fetch_live_market_data()
        apt_price = get_effective_apt_price(market_data, request.apt_price)
        
        trade_amount = get_trade_amount(request.amount_apt, request.amount_usd, apt_price, request.trade_amount)
        custom_prices = parse_custom_prices(request.current_prices)
        dex_fees = request.dex_fees or {}
        
        input_data = {
            "action": "possibilities",
            "trade_amount": trade_amount,
            "current_prices": custom_prices,
            "custom_dex_fees": dex_fees,
            "apt_price": apt_price  # Pass consistent APT price to agent
        }
        
        # Execute with timeout using the appropriate agent
        if state.use_langchain and state.langchain_agent:
            print("🤖 Using LangChain-powered opportunity search")
            result = await execute_with_timeout(
                state.langchain_agent.execute(input_data),
                timeout_ms=state.timeout_ms * 3,  # Give LangChain even more time for multiple analyses
                fallback={"status": "timeout", "opportunities": {"total_found": 0, "top_opportunities": []}}
            )
        else:
            print("⚡ Using simple opportunity search")
            result = await execute_with_timeout(
                state.arbitrage_agent.execute(input_data),
                timeout_ms=state.timeout_ms,
                fallback={"status": "timeout", "opportunities": {"total_found": 0, "top_opportunities": []}}
            )
        
        if result.get("status") == "success":
            result["investment_details"] = {"amount_apt": request.amount_apt, "amount_usd": trade_amount, "apt_price_used": apt_price, "dex_fees_applied": len(dex_fees) > 0}
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Opportunity search failed: {str(e)}")


@app.post("/arbitrage/optimize-investment")
async def optimize_investment(request: InvestmentOptimizationRequest):
    """Find optimal APT investment amount for maximum profitability"""
    try:
        # First get live market data (MISSING - this was the bug!)
        market_data = await state.fetch_live_market_data()
        apt_price = get_effective_apt_price(market_data, request.apt_price)
        
        custom_prices = parse_custom_prices(request.current_prices)
        dex_fees = request.dex_fees or {}
        
        input_data = {
            "action": "optimize_investment",
            "from_token": request.from_token,
            "to_token": request.to_token,
            "max_investment_apt": request.max_investment_apt,
            "current_prices": custom_prices,
            "dex_fees": dex_fees,
            "apt_price": apt_price  # Pass live APT price to optimizer
        }
        
        result = await execute_with_timeout(
            state.optimizer_agent.execute(input_data),
            timeout_ms=state.timeout_ms,
            fallback={"status": "timeout", "message": "Investment optimization timed out"}
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Investment optimization failed: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "ecosystem": "aptos",
        "supported_tokens": ["APT", "USDC", "USDT"],
        "timeout_ms": state.timeout_ms,
        "last_successful_fetch_seconds_ago": round(time.time() - state.last_successful_fetch, 1) if state.last_successful_fetch > 0 else None,
        "behavior": "Always fetches live data first, returns stored on timeout",
        "ai_agent": "LangChain-powered" if state.use_langchain else "Simple rule-based",
        "langchain_enabled": state.use_langchain,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# ============== Startup ==============
# Startup logic moved to lifespan handler above


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
