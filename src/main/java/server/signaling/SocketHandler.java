package server.signaling;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class SocketHandler extends TextWebSocketHandler {
  List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();

  @Override
  protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
    System.out.println(message.getPayload());
    for (WebSocketSession webSocketSession : sessions) {
      if (webSocketSession.isOpen() && !session.getId().equals(webSocketSession.getId())) {
        session.sendMessage(message);
        int size = sessions.size();
        CharSequence payload = Integer.toString(size);
        TextMessage tm = new TextMessage("size:"+payload+" session id: "+session.getId());
        session.sendMessage(tm);
      }
    }
  }

  @Override
  public void afterConnectionEstablished(WebSocketSession session) throws Exception {
    sessions.add(session);
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
    sessions.remove(session);
  }
}
