# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install dependencies separately to leverage Docker cache
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the application with optimizations
# CGO_ENABLED=0 for a pure Go static binary (compatible with alpine/distroless)
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-w -s" -o schoolpassgo .

# Runtime Stage
FROM alpine:latest

# Security: Install CA certificates if the app needs to make HTTPS requests
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy the binary from the build stage
COPY --from=builder /app/schoolpassgo .

# Copy static assets and templates
COPY --from=builder /app/static ./static
COPY --from=builder /app/templates ./templates

# Pre-create the uploads directory to ensure correct permissions
RUN mkdir -p uploads

# Expose the application port
EXPOSE 8080

# Environment variables (can be overridden in docker-compose.yml)
ENV PORT=8080

# Start the application
CMD ["./schoolpassgo"]
