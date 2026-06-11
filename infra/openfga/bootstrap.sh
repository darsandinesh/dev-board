#!/bin/bash
# Run this AFTER docker compose up to initialize OpenFGA with our authorization model.
# Usage: bash infra/openfga/bootstrap.sh

set -e

OPENFGA_URL="http://localhost:8082"
MODEL_FILE="infra/openfga/model.fga"
ENV_FILE=".env"

echo "==> Creating OpenFGA store..."
STORE_RESPONSE=$(curl -s -X POST "$OPENFGA_URL/stores" \
  -H "Content-Type: application/json" \
  -d '{"name": "devboard"}')

STORE_ID=$(echo "$STORE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "    Store ID: $STORE_ID"

echo "==> Writing authorization model..."
# Convert .fga DSL to JSON using the fga CLI if available, otherwise use pre-built JSON
if command -v fga &> /dev/null; then
  MODEL_JSON=$(fga model transform --input-format fga --output-format json < "$MODEL_FILE")
else
  # Pre-built JSON equivalent of our model.fga
  MODEL_JSON='{
    "schema_version": "1.1",
    "type_definitions": [
      {"type": "user"},
      {
        "type": "org",
        "relations": {
          "admin": {"this": {}},
          "member": {"union": {"child": [{"this": {}}, {"computedUserset": {"relation": "admin"}}]}}
        },
        "metadata": {
          "relations": {
            "admin": {"directly_related_user_types": [{"type": "user"}]},
            "member": {"directly_related_user_types": [{"type": "user"}]}
          }
        }
      },
      {
        "type": "project",
        "relations": {
          "org": {"this": {}},
          "owner": {"this": {}},
          "editor": {"union": {"child": [{"this": {}}, {"computedUserset": {"relation": "owner"}}]}},
          "viewer": {"union": {"child": [{"this": {}}, {"computedUserset": {"relation": "editor"}}, {"tupleToUserset": {"tupleset": {"relation": "org"}, "computedUserset": {"relation": "member"}}}]}}
        },
        "metadata": {
          "relations": {
            "org": {"directly_related_user_types": [{"type": "org"}]},
            "owner": {"directly_related_user_types": [{"type": "user"}]},
            "editor": {"directly_related_user_types": [{"type": "user"}]},
            "viewer": {"directly_related_user_types": [{"type": "user"}]}
          }
        }
      },
      {
        "type": "task",
        "relations": {
          "project": {"this": {}},
          "can_edit": {"tupleToUserset": {"tupleset": {"relation": "project"}, "computedUserset": {"relation": "editor"}}},
          "can_view": {"tupleToUserset": {"tupleset": {"relation": "project"}, "computedUserset": {"relation": "viewer"}}}
        },
        "metadata": {
          "relations": {
            "project": {"directly_related_user_types": [{"type": "project"}]}
          }
        }
      }
    ]
  }'
fi

MODEL_RESPONSE=$(curl -s -X POST "$OPENFGA_URL/stores/$STORE_ID/authorization-models" \
  -H "Content-Type: application/json" \
  -d "$MODEL_JSON")

MODEL_ID=$(echo "$MODEL_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['authorization_model_id'])")
echo "    Model ID: $MODEL_ID"

echo "==> Writing to $ENV_FILE..."
# Update or append OPENFGA vars in .env
if grep -q "OPENFGA_STORE_ID" "$ENV_FILE" 2>/dev/null; then
  sed -i "s/OPENFGA_STORE_ID=.*/OPENFGA_STORE_ID=$STORE_ID/" "$ENV_FILE"
  sed -i "s/OPENFGA_MODEL_ID=.*/OPENFGA_MODEL_ID=$MODEL_ID/" "$ENV_FILE"
else
  echo "" >> "$ENV_FILE"
  echo "OPENFGA_STORE_ID=$STORE_ID" >> "$ENV_FILE"
  echo "OPENFGA_MODEL_ID=$MODEL_ID" >> "$ENV_FILE"
fi

echo ""
echo "Done! Add these to your .env:"
echo "  OPENFGA_STORE_ID=$STORE_ID"
echo "  OPENFGA_MODEL_ID=$MODEL_ID"
echo ""
echo "Test with:"
echo "  curl $OPENFGA_URL/stores/$STORE_ID/check \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"tuple_key\": {\"user\": \"user:alice\", \"relation\": \"admin\", \"object\": \"org:test\"}}'"
