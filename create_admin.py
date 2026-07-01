import os
import re
from dotenv import load_dotenv
import pymongo
import bcrypt
from getpass import getpass
from datetime import datetime

# Load environment variables from the .env file in the current directory
load_dotenv()

# --- Configuration ---
# GET MONGO_URI from .env, with a sensible default for local dev
MONGO_URI = "mongodb://localhost:27017/eventPlannerDB"
ADMIN_ROLE = "admin"
ADMIN_STATUS = "active" 

# --- Input Validation ---
def is_valid_email(email):
    return re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email)

def validate_password(password, confirm_password):
    if not password:
        return "Password cannot be empty."
    if password != confirm_password:
        return "Passwords do not match."
    if len(password) < 6:
        return "Password must be at least 6 characters long."
    return None

# --- Main Script Logic ---
def create_admin_user():
    print("--- Starting Admin User Creation Script ---")
    print(f"Loaded MONGO_URI: {MONGO_URI}") # Confirm what URI is actually being used

    if not MONGO_URI or "mongodb://" not in MONGO_URI:
        print("Error: MONGO_URI not found or invalid. Please set it in your .env file (e.g., MONGO_URI='mongodb://localhost:27017/event_planning_db').")
        return

    # --- Corrected Database Name Extraction ---
    db_name = None
    try:
        # Use a more reliable regex to extract the database name
        match = re.search(r'/(?P<database>[a-zA-Z0-9_.-]+)(?:\?|$)', MONGO_URI)
        if match:
            db_name = match.group('database')
        else:
            raise ValueError("Could not extract database name from MONGO_URI. Ensure it's in the format 'mongodb://host:port/db_name'.")
        
        print(f"Targeting Database: {db_name}")

    except ValueError as e:
        print(f"Error: {e}")
        return
    # --- End Corrected Database Name Extraction ---

    client = None
    try:
        print("Attempting to connect to MongoDB...")
        client = pymongo.MongoClient(MONGO_URI)
        client.admin.command('ping') 
        print("Successfully connected to MongoDB.")
        
        db = client[db_name]
        users_collection = db["users"]
        print(f"Using collection: {users_collection.name}")

        print("\n--- Create New Admin User ---")
        admin_fullname = input("Enter Admin Full Name: ").strip()
        admin_email = input("Enter Admin Email: ").strip().lower() 
        admin_password = getpass("Enter Admin Password: ")
        confirm_password = getpass("Confirm Admin Password: ")

        if not admin_fullname:
            print("Error: Admin Full Name is required. Aborting.")
            return
        if not admin_email:
            print("Error: Admin Email is required. Aborting.")
            return
        if not is_valid_email(admin_email):
            print("Error: Invalid email format. Aborting.")
            return

        password_error = validate_password(admin_password, confirm_password)
        if password_error:
            print(f"Error: {password_error}. Aborting.")
            return

        existing_user = users_collection.find_one({"email": admin_email})
        if existing_user:
            print(f"Error: A user with the email '{admin_email}' already exists. Aborting.")
            print(f"Existing user ID: {existing_user['_id']}, Role: {existing_user.get('role', 'N/A')}")
            return

        print(f"Hashing password for {admin_email}...")
        hashed_password = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt(10))

        admin_user_data = {
            "fullName": admin_fullname,
            "email": admin_email,
            "password": hashed_password.decode('utf-8'), 
            "role": ADMIN_ROLE,
            "status": ADMIN_STATUS,
            "createdAt": datetime.now(), 
            "updatedAt": datetime.now()
        }
        print("Prepared user data for insertion.")
        
        result = users_collection.insert_one(admin_user_data)
        if result.acknowledged:
            print(f"\n--- Admin User Created Successfully! ---")
            print(f"Inserted ID: {result.inserted_id}")
            print(f"Full Name: {admin_fullname}")
            print(f"Email: {admin_email}")
            print(f"Role: {ADMIN_ROLE}")
            print(f"Status: {ADMIN_STATUS}")
        else:
            print("\n--- WARNING: Insertion not acknowledged by MongoDB ---")
            print("This could indicate an issue even if no error was thrown.")

    except pymongo.errors.ConnectionFailure as e:
        print(f"CRITICAL ERROR: Could not connect to MongoDB. Please check your MONGO_URI and ensure MongoDB is running on localhost:27017. Details: {e}")
    except pymongo.errors.DuplicateKeyError as e:
        print(f"ERROR: Duplicate key error during insertion. A user with this unique field (e.g., email) might already exist. Details: {e}")
    except Exception as e:
        print(f"An unexpected error occurred during admin user creation: {e}")
    finally:
        if client:
            print("Closing MongoDB connection.")
            client.close()

if __name__ == "__main__":
    create_admin_user()