@echo off
setlocal

:: --- Configuration ---
set PYTHON_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip
set ZIP_FILE=python_embed.zip
set PY_DIR=py_temp

:: Check if a script was dragged onto the .bat file, otherwise default to a specific name
set TARGET_SCRIPT=%~1
if "%TARGET_SCRIPT%"=="" (
    :: CHANGE THIS to your actual python file's name if you don't want to use drag-and-drop
    set TARGET_SCRIPT=your_script.py 
)

echo [1/4] Checking for lightweight Python...
if exist "%ZIP_FILE%" (
    echo Found "%ZIP_FILE%" locally. Skipping download.
) else (
    echo Downloading lightweight Python from servers...
    curl -s -o "%ZIP_FILE%" "%PYTHON_URL%"
)

echo [2/4] Extracting Python to "%PY_DIR%"...
if not exist "%PY_DIR%" mkdir "%PY_DIR%"
tar -xf "%ZIP_FILE%" -C "%PY_DIR%"

echo [3/4] Executing and Compiling the script...
:: 1. Execute the script so you can see it run
"%PY_DIR%\python.exe" "%TARGET_SCRIPT%"

:: 2. Compile the script into a .pyc (bytecode) file
"%PY_DIR%\python.exe" -m py_compile "%TARGET_SCRIPT%"
echo.
echo Compilation complete. Check the newly created __pycache__ folder for your .pyc file.
echo.

echo [4/4] Cleaning up...
:: To enable deletion, remove the "REM " from the start of the next two lines
REM rmdir /s /q "%PY_DIR%"
REM del "%ZIP_FILE%"

echo All done!
pause
endlocal