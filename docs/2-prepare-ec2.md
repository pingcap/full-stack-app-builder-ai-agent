# Prepare EC2 to serve the Agent

- Install NodeJS Environment
  ```shell
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  source ~/.bashrc
  nvm install 24
  ```

- Install Redis
  ```shell
  sudo dnf update -y
  sudo dnf install redis6 -y
  ```

