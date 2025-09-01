import React from "react";
import { Box, Typography } from "@mui/material";

const Header = () => {
  return (
    <Box
      sx={{
        background: "linear-gradient(90deg,rgb(24, 43, 61), #3498db)",
        color: "white",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <img
          src="/logo192.png"
          alt="Logo"
          style={{
            height: "60px",
            width: "60px",
            objectFit: "contain",
          }}
        />
        <Box sx={{ textAlign: "center" }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{ marginBottom: "10px", color: "white" }}
          >
            倉庫條碼收單管理系統
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default Header;
