pipeline {
  agent none
  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 60, unit: 'MINUTES')
  }
  stages {
    stage('Build') {
      agent any
      environment {
        PATH = "C:\\Program Files\\nodejs;C:\\Program Files\\Git\\cmd;${env.PATH}"
      }
      stages {
        stage('Install') {
          steps {
            bat 'npm ci || npm install'
          }
        }
        stage('Contract') {
          steps {
            bat 'node scripts\\ci\\check-api-contract.mjs'
          }
        }
        stage('Test') {
          steps {
            bat 'npm test'
          }
        }
        stage('Build artifacts') {
          steps {
            bat 'npm run build'
          }
        }
        stage('Archive') {
          steps {
            archiveArtifacts artifacts: 'dist/**/*', fingerprint: true, allowEmptyArchive: true
          }
        }
      }
    }
    stage('Integration') {
      when {
        anyOf {
          branch 'main'
          tag pattern: 'v*', comparator: 'GLOB'
        }
      }
      steps {
        build job: 'audio-streaming/integration', wait: true, propagate: true
      }
    }
    stage('Deploy staging') {
      when { branch 'main' }
      steps {
        build job: 'audio-streaming/deploy-staging-web', wait: true, propagate: true
      }
    }
    stage('Staging smoke') {
      when { branch 'main' }
      steps {
        build job: 'audio-streaming/staging-smoke', wait: true, propagate: true
      }
    }
    stage('Tag release') {
      when { tag pattern: 'v*', comparator: 'GLOB' }
      agent any
      steps {
        echo "Release tag ${env.TAG_NAME}: web dist archived from Build stage; no staging deploy from tags."
      }
    }
  }
}
