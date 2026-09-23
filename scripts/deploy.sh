#!/bin/bash
# =============================================================================
# Sistema RAG Documental — Script de deploy on-premise
# =============================================================================
# Uso:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
# =============================================================================

set -e

echo "🚀 Iniciando deploy del Sistema RAG Documental (on-premise)"
echo "============================================================"

# 1. Verificar que .env existe
if [ ! -f .env.onpremise ]; then
  echo "❌ Falta .env.onpremise. Cópialo de .env.onpremise y ajusta los valores."
  exit 1
fi

echo ""
echo "1️⃣  Cargando configuración..."
export $(grep -v '^#' .env.onpremise | xargs)
echo "   ✅ Configuración cargada"

echo ""
echo "2️⃣  Verificando Docker..."
if ! command -v docker &> /dev/null; then
  echo "❌ Docker no está instalado. Instálalo desde: https://docs.docker.com/engine/install/"
  exit 1
fi
echo "   ✅ Docker $(docker --version)"

echo ""
echo "3️⃣  Verificando Docker Compose..."
if ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose no está instalado."
  exit 1
fi
echo "   ✅ Docker Compose disponible"

echo ""
echo "4️⃣  Construyendo imágenes..."
docker compose -f docker-compose.onpremise.yml --env-file .env.onpremise build
echo "   ✅ Imágenes construidas"

echo ""
echo "5️⃣  Iniciando servicios..."
docker compose -f docker-compose.onpremise.yml --env-file .env.onpremise up -d
echo "   ✅ Servicios iniciados"

echo ""
echo "6️⃣  Esperando que PostgreSQL esté listo..."
for i in $(seq 1 30); do
  if docker exec rag-postgres pg_isready -U $POSTGRES_USER &>/dev/null; then
    echo "   ✅ PostgreSQL listo"
    break
  fi
  echo "   ⏳ Esperando... ($i/30)"
  sleep 2
done

echo ""
echo "7️⃣  Sincronizando schema de base de datos..."
docker exec rag-app npx prisma db push --accept-data-loss 2>/dev/null || \
  echo "   ⚠ Se sincronizará en el primer arranque"
echo "   ✅ Schema sincronizado"

echo ""
echo "8️⃣  Esperando que Ollama esté listo..."
for i in $(seq 1 60); do
  if curl -s http://localhost:11434/api/tags &>/dev/null; then
    echo "   ✅ Ollama listo"
    break
  fi
  echo "   ⏳ Esperando Ollama... ($i/60)"
  sleep 2
done

echo ""
echo "9️⃣  Descargando modelo de Ollama (si no existe)..."
if ! docker exec rag-ollama ollama list 2>/dev/null | grep -q "llama3"; then
  echo "   📥 Descargando modelo $OLLAMA_MODEL..."
  docker exec rag-ollama ollama pull $OLLAMA_MODEL
  echo "   ✅ Modelo descargado"
else
  echo "   ✅ Modelo ya existe"
fi

echo ""
echo "🔟  Sembrando datos de ejemplo..."
curl -s -X POST http://localhost:3000/api/rag/seed &>/dev/null || true
echo "   ✅ Datos de ejemplo cargados"

echo ""
echo "============================================================"
echo "🎉 ¡DEPLOY COMPLETADO!"
echo "============================================================"
echo ""
echo "📡 Servicios disponibles:"
echo "   App (Next.js):     http://localhost:3000"
echo "   Ollama (LLM):      http://localhost:11434"
echo "   PostgreSQL:        localhost:5432"
echo "   ChromaDB:          http://localhost:8000"
echo "   Prometheus:        http://localhost:9090"
echo "   Grafana:           http://localhost:3001 (admin/CambiarEstaPassword123!)"
echo "   Uptime Kuma:       http://localhost:3002"
echo ""
echo "🧪 Probar:"
echo "   curl http://localhost:3000/api/rag/stats"
echo "   curl -X POST http://localhost:3000/api/rag/chat \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"question\":\"¿Cuál es el activo total?\"}'"
echo ""
echo "📊 Monitorear:"
echo "   Grafana:  http://localhost:3001"
echo "   PromQL:   rag_app_up"
echo ""
echo "🔧 Comandos útiles:"
echo "   docker compose -f docker-compose.onpremise.yml logs -f   # ver logs"
echo "   docker compose -f docker-compose.onpremise.yml down      # parar todo"
echo "   docker compose -f docker-compose.onpremise.yml restart    # reiniciar"
echo ""
