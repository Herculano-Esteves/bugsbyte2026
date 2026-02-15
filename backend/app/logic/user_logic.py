from app.models.schemas import UserCreate, UserLogin, UserResponse
from app.database.user_repository import UserRepository
from app.database.visited_airport_repository import VisitedAirportRepository
from fastapi import HTTPException
import json
import bcrypt

class UserLogic:
    @staticmethod
    def register_user(user: UserCreate) -> UserResponse:
        existing_user = UserRepository.get_user_by_email(user.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        new_user = UserRepository.create_user(user)
        if not new_user:
             raise HTTPException(status_code=500, detail="Failed to create user")
             
        return new_user

    @staticmethod
    def login_user(credentials: UserLogin) -> UserResponse:
        user_data = UserRepository.get_user_by_email(credentials.email)
        if not user_data:
            raise HTTPException(status_code=401, detail="Invalid email or password")
            
        if not bcrypt.checkpw(credentials.password.encode('utf-8'), user_data['password'].encode('utf-8')):
             raise HTTPException(status_code=401, detail="Invalid email or password")
             
        return UserResponse(
                id=user_data['id'],
                name=user_data['name'],
                email=user_data['email'],
                address=user_data['address'],
                ticket_info=json.loads(user_data['ticket_info']) if isinstance(user_data['ticket_info'], str) else user_data['ticket_info'],
                read_articles=json.loads(user_data['sent_items']) if isinstance(user_data['sent_items'], str) else user_data['sent_items']
            )

    @staticmethod
    def logout_user(user_id: int):
        # Do not reset history on logout
        return {"message": "Logged out successfully"}

    @staticmethod
    def get_user(user_id: int) -> UserResponse:
        user = UserRepository.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
        
    @staticmethod
    def mark_article_as_read(user_id: int, article_id: int):
        user = UserRepository.get_user_by_id(user_id)
        if user:
            # Check if article is already read (unique history)
            if article_id not in user.read_articles:
                user.read_articles.append(article_id)
                UserRepository.update_read_articles(user_id, user.read_articles)
                return {"message": "Article marked as read", "read_count": len(user.read_articles)}
            return {"message": "Article already read", "read_count": len(user.read_articles)}
        raise HTTPException(status_code=404, detail="User not found")

    @staticmethod
    def record_airport_visit(user_id: int, airport_iata: str):
        user = UserRepository.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        VisitedAirportRepository.add_visit(user_id, airport_iata)
        return {"message": "Airport visit recorded", "airport_iata": airport_iata.upper()}

    @staticmethod
    def get_visited_airports(user_id: int):
        user = UserRepository.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return VisitedAirportRepository.get_user_airport_stats(user_id)
