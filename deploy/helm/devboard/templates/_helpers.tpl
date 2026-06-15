{{/*
Shared helpers for the umbrella chart and (via the same names) subcharts.
Component DNS name = <release>-<component>, e.g. "devboard-postgres".
*/}}

{{- define "devboard.secretName" -}}
{{ .Release.Name }}-secrets
{{- end -}}

{{/* Common labels applied to every object. */}}
{{- define "devboard.labels" -}}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: devboard
helm.sh/chart: devboard-{{ .Chart.Version | default "0.1.0" }}
{{- end -}}
