@echo off
setlocal
pushd "%~dp0.." || exit /b 1
if not exist "deploy\.env.docker-local" (
    echo Create deploy\.env.docker-local with MSSQL_PASSWORD, JWT_SECRET_KEY, and IMAGE_TAG first.
    popd
    exit /b 1
)
docker compose --env-file deploy/.env.docker-local -f deploy/docker-compose.local.yml up --build -d --wait --wait-timeout 240
set "attendance_exit=%ERRORLEVEL%"
popd
exit /b %attendance_exit%
