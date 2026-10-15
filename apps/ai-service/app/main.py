from fastapi import FastAPI

app = FastAPI(title='AI Inference Service', version='0.1.0')


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok', 'service': 'ai-service'}


@app.get('/ready')
def ready() -> dict[str, str]:
    return {'status': 'ok', 'service': 'ai-service'}
