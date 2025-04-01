package middlewares

import (
	"log"

	"github.com/gin-gonic/gin"
)

// LoggerMiddleware 是示範用的 logging middleware
func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("[Logger] %s %s", c.Request.Method, c.Request.URL.Path)
		c.Next()
	}
}
