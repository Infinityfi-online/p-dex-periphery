// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

/**
 * @title WETH9
 * @dev Wrapped Ether (WETH) is an ERC20 token that wraps ETH
 */
contract WETH9 {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;

    event Approval(address indexed src, address indexed guy, uint wad);
    event Transfer(address indexed src, address indexed dst, uint wad);
    event Deposit(address indexed dst, uint wad);
    event Withdrawal(address indexed src, uint wad);

    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;

    /**
     * @dev Deposit ETH to get WETH
     */
    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw WETH to get ETH
     */
    function withdraw(uint wad) public {
        require(balanceOf[msg.sender] >= wad, "WETH9: insufficient balance");
        balanceOf[msg.sender] -= wad;
        payable(msg.sender).transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }

    /**
     * @dev Total supply is equal to ETH balance of this contract
     */
    function totalSupply() public view returns (uint) {
        return address(this).balance;
    }

    /**
     * @dev Approve the spender to spend wad from msg.sender
     */
    function approve(address guy, uint wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }

    /**
     * @dev Transfer wad tokens from msg.sender to dst
     */
    function transfer(address dst, uint wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    /**
     * @dev Transfer wad tokens from src to dst
     */
    function transferFrom(address src, address dst, uint wad) public returns (bool) {
        if (src != msg.sender && allowance[src][msg.sender] != type(uint).max) {
            require(allowance[src][msg.sender] >= wad, "WETH9: insufficient allowance");
            allowance[src][msg.sender] -= wad;
        }

        require(balanceOf[src] >= wad, "WETH9: insufficient balance");
        
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        
        emit Transfer(src, dst, wad);
        
        return true;
    }

    /**
     * @dev Allows to deposit ETH and get WETH by sending ETH to the contract
     */
    receive() external payable {
        deposit();
    }
} 