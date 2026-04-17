**Keylogger and File Hider:**

This repository contains files for a keylogger and file hider script in Windows. The keylogger logs key events using the keyboard library in Python, and the logs are saved to a file called logs.txt. The file hider script is written in VBScript and hides specific files listed in the filesToHide array.

**File Descriptions:**

- Keylogger.py: Python script for logging key events using the keyboard library.
- LauncherForWindows.bat: Batch file for installing/upgrading pip, installing required packages, and running Keylogger.py.
- requirements.txt: Text file listing the required Python packages for the keylogger.
- file_hider.vbs: VBScript file for hiding files listed in the filesToHide array.

**Installation and Usage:**

1. Clone the repository to your local machine.
2. Run LauncherForWindows.bat to install/upgrade pip, install required packages, and run the keylogger.
3. Key events will be logged to logs.txt in the same directory.
4. You can use the file_hider.vbs script to hide or unhide the files(This only marks the files as hidden from properties of the file).
5. You can also add the Files to your Startup folder to start the program everytime the computer turns on.

**NOTE:**
 ***Some parts of these Programs are made by an AI. Secondly, I suggest that you DO NOT RENAME THE FILES unless you know what you are doing and you are going to rename the files inside the code of other files too.*** *(Sorry, I'm a newbie, I couldn't find a solution to this problem. Let me know if you know any)*

**About the Code:**

Welcome to the Keylogger and File Hider repository! This collection of scripts allows you to log key events and hide files. The keylogger is powered by the keyboard library in Python, and the logs are saved to logs.txt. The file hider script is written in VBScript and can hide files like a pro.

**Warning:**

These scripts are for educational and ethical purposes only. Use them responsibly and always comply with applicable laws and regulations. Stay stealthy, my friend!
