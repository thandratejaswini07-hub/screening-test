from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/mnr_screening"
    MODEL_PATH: str = "./models/Qwen2.5-VL-3B-Instruct"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    MAX_IMAGE_SIZE: int = 10 * 1024 * 1024

    class Config:
        env_file = ".env"

settings = Settings()