pipeline {
  agent any
  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 60, unit: 'MINUTES')
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
    stage('Archive') {
      steps {
        archiveArtifacts artifacts: 'dist/**/*', fingerprint: true, allowEmptyArchive: true
      }
    }
    stage('Integration') {
      steps {
        build job: 'music-streaming/integration', wait: true, propagate: true
      }
    }
    stage('Deploy staging') {
      steps {
        build job: 'music-streaming/deploy-staging-web', wait: true, propagate: true
      }
    }
  }
}
