pipeline {
  agent any
  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 45, unit: 'MINUTES')
  }
  environment {
    PATH = "C:\\Program Files\\nodejs;C:\\Program Files\\Git\\cmd;${env.PATH}"
  }
  stages {
    stage('Install') {
      steps {
        bat 'npm ci || npm install'
      }
    }
    stage('Test') {
      steps {
        bat 'npm test'
      }
    }
    stage('Build') {
      steps {
        bat 'npm run build'
      }
    }
  }
}
