package api

import (
	"net/http"
	"strconv"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/rtta/chat-server/internal/operator"
)

// HandleCheckSettle triggers an immediate settle eligibility check for a room.
// Requires a valid chat auth token and an existing identity record in the room.
func HandleCheckSettle(opService *operator.Service, watcher *operator.Watcher) gin.HandlerFunc {
	return func(c *gin.Context) {
		if opService == nil || watcher == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Operator watcher unavailable"})
			return
		}

		roomId, err := strconv.Atoi(c.Param("roomId"))
		if err != nil || roomId <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
			return
		}

		addr, exists := c.Get("address")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
			return
		}

		if _, err := opService.FindIdentityRecord(roomId, addr.(string)); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Player is not registered in this room"})
			return
		}

		triggered, reason, err := watcher.CheckSettleNow(c.Request.Context(), roomId)
		if err != nil {
			log.Printf("[API] check-settle failed for room %d: reason=%s err=%v", roomId, reason, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":     "Immediate settle check failed",
				"triggered": false,
				"reason":    reason,
				"detail":    err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"checked":   true,
			"triggered": triggered,
			"reason":    reason,
		})
	}
}
