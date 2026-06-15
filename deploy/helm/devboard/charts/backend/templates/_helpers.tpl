{{/*
DB env shared by the backend Deployment and the Alembic migrate Job.
The password stays in the Secret; Kubernetes expands $(POSTGRES_PASSWORD)
into DATABASE_URL at container start, so the secret is never rendered into
a ConfigMap or manifest.
*/}}
{{- define "backend.dbEnv" -}}
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "devboard.secretName" . }}
      key: POSTGRES_PASSWORD
- name: DATABASE_URL
  value: postgresql+asyncpg://{{ .Values.global.postgres.user }}:$(POSTGRES_PASSWORD)@{{ .Release.Name }}-postgres:5432/{{ .Values.global.postgres.database }}
{{- end -}}
