FROM golang:1.26-alpine

WORKDIR /app

# Install necessary tools (optional, but good for Alpine)
RUN apk --no-cache add ca-certificates tzdata

# Install dependencies separately to leverage Docker cache
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Expose the application port
EXPOSE 8080

# Environment variables
ENV PORT=8080

# Run the project using go run
CMD ["go", "run", "main.go"]
