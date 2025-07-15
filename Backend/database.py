"""
Database models and operations for Kundali app authentication
Compatible with FastAPI and async operations
"""

import aiosqlite
import sqlite3
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import json
import os
from pathlib import Path

# Database file path
DB_PATH = Path(__file__).parent / "kundali_users.db"

class DatabaseManager:
    """Async database manager for user authentication and kundali data"""
    
    def __init__(self, db_path: str = str(DB_PATH)):
        self.db_path = db_path
        self.init_db()
    
    def init_db(self):
        """Initialize database tables synchronously"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Users table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wallet_address TEXT UNIQUE NOT NULL,
                    email TEXT,
                    name TEXT,
                    profile_image TEXT,
                    auth_method TEXT NOT NULL DEFAULT 'web3',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # User sessions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token TEXT UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            ''')
            
            # Kundali readings table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS kundali_readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    birth_date TEXT NOT NULL,
                    birth_time TEXT NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    timezone_str TEXT NOT NULL,
                    place_name TEXT,
                    kundali_data TEXT NOT NULL,
                    chart_image_path TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            ''')
            
            # Create indexes for better performance
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_readings_user ON kundali_readings(user_id)')
            
            conn.commit()
            print("✅ Database initialized successfully")
    
    async def create_or_update_user(
        self, 
        wallet_address: str, 
        email: Optional[str] = None,
        name: Optional[str] = None,
        profile_image: Optional[str] = None,
        auth_method: str = 'web3'
    ) -> int:
        """Create new user or update existing one"""
        async with aiosqlite.connect(self.db_path) as db:
            # Check if user exists
            async with db.execute(
                'SELECT id FROM users WHERE wallet_address = ?', 
                (wallet_address,)
            ) as cursor:
                existing_user = await cursor.fetchone()
            
            if existing_user:
                # Update existing user
                await db.execute('''
                    UPDATE users 
                    SET email = ?, name = ?, profile_image = ?, auth_method = ?, 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE wallet_address = ?
                ''', (email, name, profile_image, auth_method, wallet_address))
                user_id = existing_user[0]
            else:
                # Create new user
                async with db.execute('''
                    INSERT INTO users (wallet_address, email, name, profile_image, auth_method)
                    VALUES (?, ?, ?, ?, ?)
                ''', (wallet_address, email, name, profile_image, auth_method)) as cursor:
                    user_id = cursor.lastrowid
            
            await db.commit()
            return user_id
    
    async def create_session(self, user_id: int, token: str, expires_at: datetime) -> bool:
        """Create user session"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('''
                INSERT INTO user_sessions (user_id, token, expires_at)
                VALUES (?, ?, ?)
            ''', (user_id, token, expires_at.isoformat()))
            await db.commit()
            return True
    
    async def get_user_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Get user by session token"""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute('''
                SELECT u.id, u.wallet_address, u.email, u.name, u.profile_image, u.auth_method,
                       s.expires_at
                FROM users u
                JOIN user_sessions s ON u.id = s.user_id
                WHERE s.token = ? AND s.expires_at > datetime('now')
            ''', (token,)) as cursor:
                row = await cursor.fetchone()
                
                if row:
                    return {
                        'id': row[0],
                        'wallet_address': row[1],
                        'email': row[2],
                        'name': row[3],
                        'profile_image': row[4],
                        'auth_method': row[5],
                        'expires_at': row[6]
                    }
                return None
    
    async def delete_session(self, token: str) -> bool:
        """Delete user session (logout)"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('DELETE FROM user_sessions WHERE token = ?', (token,))
            await db.commit()
            return True
    
    async def save_kundali_reading(
        self,
        user_id: int,
        birth_date: str,
        birth_time: str,
        latitude: float,
        longitude: float,
        timezone_str: str,
        place_name: Optional[str],
        kundali_data: Dict[str, Any],
        chart_image_path: Optional[str] = None
    ) -> int:
        """Save kundali reading to database"""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute('''
                INSERT INTO kundali_readings 
                (user_id, birth_date, birth_time, latitude, longitude, timezone_str, 
                 place_name, kundali_data, chart_image_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id, birth_date, birth_time, latitude, longitude, 
                timezone_str, place_name, json.dumps(kundali_data), chart_image_path
            )) as cursor:
                reading_id = cursor.lastrowid
            
            await db.commit()
            return reading_id
    
    async def get_user_readings(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get user's kundali readings"""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute('''
                SELECT id, birth_date, birth_time, latitude, longitude, timezone_str,
                       place_name, kundali_data, chart_image_path, created_at
                FROM kundali_readings
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            ''', (user_id, limit)) as cursor:
                rows = await cursor.fetchall()
                
                readings = []
                for row in rows:
                    readings.append({
                        'id': row[0],
                        'birth_date': row[1],
                        'birth_time': row[2],
                        'latitude': row[3],
                        'longitude': row[4],
                        'timezone_str': row[5],
                        'place_name': row[6],
                        'kundali_data': json.loads(row[7]),
                        'chart_image_path': row[8],
                        'created_at': row[9]
                    })
                
                return readings
    
    async def cleanup_expired_sessions(self):
        """Clean up expired sessions"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('DELETE FROM user_sessions WHERE expires_at < datetime("now")')
            await db.commit()

# Global database instance
db_manager = DatabaseManager()

# Utility functions for FastAPI
async def get_db():
    """Dependency for FastAPI"""
    return db_manager

def init_database():
    """Initialize database - call this on startup"""
    db_manager.init_db()
    print("🗄️ Database connection established")

if __name__ == "__main__":
    # Test database initialization
    init_database()
    print("Database test completed successfully!")
