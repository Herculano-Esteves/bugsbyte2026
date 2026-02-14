from app.models.schemas import UserCreate, UserLogin, UserResponse
from app.database.user_repository import UserRepository
from fastapi import HTTPException
import json

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
            
        # In a real app, verify hash. Here we just compare strings
        if user_data['password'] != credentials.password:
             raise HTTPException(status_code=401, detail="Invalid email or password")
             
        return UserResponse(
                id=user_data['id'],
                name=user_data['name'],
                email=user_data['email'],
                address=user_data['address'],
                ticket_info=json.loads(user_data['ticket_info']) if isinstance(user_data['ticket_info'], str) else user_data['ticket_info'],
                sent_items=json.loads(user_data['sent_items']) if isinstance(user_data['sent_items'], str) else user_data['sent_items']
            )

    @staticmethod
    def logout_user(user_id: int):
        # Reset sent items on logout as per requirements
        UserRepository.update_sent_items(user_id, [])
        return {"message": "Logged out successfully and history reset"}

    @staticmethod
    def get_user(user_id: int) -> UserResponse:
        user = UserRepository.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
        
    @staticmethod
    def add_sent_item(user_id: int, item_id: int):
        user = UserRepository.get_user_by_id(user_id)
        if user:
            if item_id not in user.sent_items:
                user.sent_items.append(item_id)
                UserRepository.update_sent_items(user_id, user.sent_items)
