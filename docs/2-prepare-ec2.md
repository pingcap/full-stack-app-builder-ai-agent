# Prepare EC2 to serve the Agent

This section will guide you through the steps to prepare your EC2 instance to serve the Agent.
We will use Amazon Linux 2 as the base OS.

Read the EC2 [documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EC2_GetStarted.html) to learn how to create an EC2 instance.

Make sure you have exposed port 80 and 3001 to the internet.

## Install required packages

- Install NodeJS Environment
  ```shell
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  source ~/.bashrc
  nvm install 24
  npm install -g pm2
  
  # Allow node to bind 80 port
  sudo setcap 'cap_net_bind_service=+ep' `which node`
  ```

- Install Redis
  ```shell
  sudo dnf update -y
  sudo dnf install redis6 -y
  sudo systemctl start redis6
  ```

- Install Git
  ```shell
  sudo dnf install -y git
  ```
