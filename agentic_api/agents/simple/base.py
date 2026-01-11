"""Base Agent class for Aptos arbitrage system"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime
import time
import asyncio


class BaseAgent(ABC):
    """Base agent for Aptos arbitrage system with caching and timeout handling"""
    
    def __init__(self, name: str):
        self.name = name
        self.last_result: Dict[str, Any] = {}
        self.last_update: float = 0
        self.cache_duration: float = 30.0  # Cache for 30 seconds
        self.timeout: float = 5.0  # Max 5 second timeout
    
    @abstractmethod
    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the agent's task"""
        pass
    
    def get_cached_result(self) -> Optional[Dict[str, Any]]:
        """Get cached result if still valid"""
        if self.is_cache_valid():
            return self.last_result
        return None
    
    def cache_result(self, result: Dict[str, Any]):
        """Cache the result with timestamp"""
        self.last_result = result
        self.last_update = time.time()
    
    def is_cache_valid(self) -> bool:
        """Check if cached result is still valid"""
        return (time.time() - self.last_update) < self.cache_duration
    
    def get_cache_age(self) -> float:
        """Get age of cached data in seconds"""
        return time.time() - self.last_update
    
    async def execute_with_timeout(self, coro, fallback_data: Dict[str, Any] = None):
        """Execute coroutine with timeout protection"""
        try:
            return await asyncio.wait_for(coro, timeout=self.timeout)
        except asyncio.TimeoutError:
            print(f"⚠️ {self.name} timed out after {self.timeout}s")
            return fallback_data or self.get_cached_result() or {"status": "timeout", "agent": self.name}
        except Exception as e:
            print(f"❌ {self.name} error: {e}")
            return fallback_data or self.get_cached_result() or {"status": "error", "agent": self.name, "error": str(e)}