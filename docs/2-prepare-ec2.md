# Prepare EC2 to serve the Agent

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
